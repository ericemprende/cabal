import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PLANS, grantDays, isPlanKey } from '@/lib/premium'
import { NOW_FINAL, fetchNowPayment, nowpaymentsConfigured, verifyNowSignature } from '@/lib/nowpayments'

/**
 * POST /api/webhooks/nowpayments — notificación de pago (IPN).
 *
 * 1. Firma HMAC-SHA512 con el secreto IPN (cabecera x-nowpayments-sig).
 * 2. El pedido (order_id) tiene que ser un pago que creamos nosotros.
 * 3. Antes de dar acceso, el estado "finished" se vuelve a pedir a la API de
 *    NOWPayments y se comprueban importe y moneda: el dinero manda sobre el
 *    mensaje.
 * 4. Conceder es idempotente: Subscription.paymentId es único.
 */
export async function POST(req: Request) {
  if (!nowpaymentsConfigured()) {
    return NextResponse.json({ error: 'NOWPayments no está configurado' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(await req.text())
  } catch {
    return NextResponse.json({ error: 'JSON no válido' }, { status: 400 })
  }
  if (!verifyNowSignature(body, req.headers.get('x-nowpayments-sig'))) {
    return NextResponse.json({ error: 'Firma no válida' }, { status: 401 })
  }

  const orderId = String(body.order_id ?? '')
  const paymentId = body.payment_id != null ? String(body.payment_id) : null
  const status = String(body.payment_status ?? '')
  const payment = orderId ? await db.payment.findUnique({ where: { id: orderId } }) : null
  // Un pedido que no es nuestro no se va a arreglar reintentando: 200 y fuera
  if (!payment || payment.provider !== 'nowpayments') {
    return NextResponse.json({ ignored: true })
  }

  try {
    // Las IPN pueden llegar desordenadas: un pago cerrado no vuelve atrás
    // (salvo que se reembolse)
    const closed = payment.status === 'finished' && status !== 'refunded'
    const commonFields = {
      providerPaymentId: paymentId ?? payment.providerPaymentId,
      payCurrency: typeof body.pay_currency === 'string' ? body.pay_currency : payment.payCurrency,
      actuallyPaid: Number.isFinite(Number(body.actually_paid)) ? Number(body.actually_paid) : payment.actuallyPaid,
    }
    // "finished" no se guarda todavía: si la verificación de abajo falla (o
    // NOWPayments no responde), el pago no debe quedar marcado como terminado
    // sin de verdad estarlo — el panel de admin lo usa para saber si ya cobró.
    if (!closed && status && status !== 'finished') {
      await db.payment.update({ where: { id: payment.id }, data: { status, ...commonFields } })
    }

    const alreadyGranted = await db.subscription.findUnique({ where: { paymentId: payment.id }, select: { id: true } })
    if (status === 'finished' && paymentId && !alreadyGranted) {
      const confirmed = await fetchNowPayment(paymentId)
      const amountOk = Math.abs(Number(confirmed.price_amount) - payment.amountUsd) < 0.01
      const currencyOk = String(confirmed.price_currency ?? '').toLowerCase() === 'usd'
      if (confirmed.payment_status !== 'finished' || String(confirmed.order_id) !== payment.id) {
        console.warn(`[nowpayments] el pago ${paymentId} no está terminado según la API`)
        return NextResponse.json({ pending: true })
      }
      if (!amountOk || !currencyOk) {
        console.error(`[nowpayments] importe inesperado en ${payment.id}: ${confirmed.price_amount} ${confirmed.price_currency}`)
        await db.payment.update({ where: { id: payment.id }, data: { status: 'amount_mismatch', ...commonFields } })
        return NextResponse.json({ received: true })
      }
      const plan = isPlanKey(payment.plan) ? payment.plan : 'monthly'
      await grantDays(payment.userId, PLANS[plan].days, {
        provider: 'nowpayments',
        plan,
        paymentId: payment.id,
      }).catch((e: { code?: string }) => {
        if (e?.code !== 'P2002') throw e // P2002 = ya concedido por una IPN anterior
      })
      // Confirmado y concedido: ahora sí queda como terminado.
      await db.payment.update({ where: { id: payment.id }, data: { status: 'finished', ...commonFields } })
    }
    return NextResponse.json({ received: true, final: NOW_FINAL.has(status) })
  } catch (e) {
    console.error(`[nowpayments] IPN ${payment.id}`, e)
    // 500: NOWPayments reintenta la notificación
    return NextResponse.json({ error: 'Error al procesar el pago' }, { status: 500 })
  }
}
