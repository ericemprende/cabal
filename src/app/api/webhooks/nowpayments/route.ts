import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PLANS, grantDays, isPlanKey } from '@/lib/premium'
import { PACKS, creditAmmo, giftPlanAmmo, isPackKey } from '@/lib/ammo'
import { DONATION_PLAN, creditDonation } from '@/lib/donate-server'
import { NOW_FINAL, fetchNowPayment, nowpaymentsConfigured, verifyNowSignature } from '@/lib/nowpayments'

/**
 * POST /api/webhooks/nowpayments — notificación de pago (IPN).
 *
 * 1. Firma HMAC-SHA512 con el secreto IPN (cabecera x-nowpayments-sig).
 * 2. El pedido (order_id) tiene que ser un pago que creamos nosotros.
 * 3. Antes de dar acceso, el estado "finished" se vuelve a pedir a la API de
 *    NOWPayments y se comprueban importe y moneda: el dinero manda sobre el
 *    mensaje.
 * 4. Conceder es idempotente: Subscription.paymentId es único (y lo mismo
 *    AmmoEntry.paymentId y Donation.paymentId).
 *
 * El mismo endpoint sirve los tres productos que se pagan en cripto, y el plan
 * del pago es lo que los distingue: un plan Premium, un cargador de munición
 * (ammo_*) o una donación voluntaria (DONATION_PLAN), que abona puntos.
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

    // Un cargador de munición o una donación se pagan igual que un plan, pero
    // en vez de dar acceso acreditan balas o puntos. El plan los distingue.
    const ammoPack = payment.plan.startsWith('ammo_') ? payment.plan.slice(5) : null
    const isDonation = payment.plan === DONATION_PLAN
    const alreadyGranted = isDonation
      ? await db.donation.findUnique({ where: { paymentId: payment.id }, select: { id: true } })
      : ammoPack
        ? await db.ammoEntry.findUnique({ where: { paymentId: payment.id }, select: { id: true } })
        : await db.subscription.findUnique({ where: { paymentId: payment.id }, select: { id: true } })
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
      if (isDonation) {
        // Los puntos salen del importe confirmado, no del que dijo el navegador.
        await creditDonation({ id: payment.id, userId: payment.userId, amountUsd: payment.amountUsd })
      } else if (ammoPack) {
        if (!isPackKey(ammoPack)) {
          console.error(`[nowpayments] cargador desconocido en ${payment.id}: ${payment.plan}`)
          return NextResponse.json({ received: true })
        }
        await creditAmmo(payment.userId, PACKS[ammoPack].bullets, {
          reason: 'purchase',
          packKey: ammoPack,
          paymentId: payment.id,
        })
      } else {
        const plan = isPlanKey(payment.plan) ? payment.plan : 'monthly'
        const sub = await grantDays(payment.userId, PLANS[plan].days, {
          provider: 'nowpayments',
          plan,
          paymentId: payment.id,
        }).catch((e: { code?: string }) => {
          if (e?.code !== 'P2002') throw e // P2002 = ya concedido por una IPN anterior
          return null
        })
        // La munición de regalo del plan va atada a la suscripción: si esta IPN
        // se repite, giftPlanAmmo la reconoce y no regala dos veces.
        if (sub) await giftPlanAmmo(payment.userId, plan, sub.id)
      }
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
