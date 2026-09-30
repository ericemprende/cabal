import { NextResponse } from 'next/server'
import { blockIosAppPurchase } from '@/lib/native-app'
import { db } from '@/lib/db'
import { appOrigin } from '@/lib/oauth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { PLANS, activeStripeSubscription, getPremiumSettings, getViewer, isPlanKey } from '@/lib/premium'
import { createStripeCheckout, stripePlanAvailable } from '@/lib/stripe'
import { createNowInvoice, nowpaymentsConfigured } from '@/lib/nowpayments'

/**
 * POST /api/premium/checkout — { plan, method: 'card' | 'crypto' }
 * Devuelve { url } de la página de pago del proveedor:
 *  - card   → Stripe Checkout (suscripción que se renueva sola)
 *  - crypto → factura de NOWPayments (pago único por el periodo del plan)
 * El acceso se activa cuando llega la confirmación del proveedor (webhook).
 */
export async function POST(req: Request) {
  const blocked = blockIosAppPurchase(req)
  if (blocked) return blocked
  try {
    const viewer = await getViewer(req)
    if (!viewer.userId) {
      return NextResponse.json({ error: 'Inicia sesión para suscribirte' }, { status: 401 })
    }
    const limit = await rateLimit(`checkout:${viewer.userId}`, 10, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const plan = body.plan
    const method = body.method === 'crypto' ? 'crypto' : body.method === 'card' ? 'card' : null
    if (!isPlanKey(plan) || !method) {
      return NextResponse.json({ error: 'Plan o método de pago no válido' }, { status: 400 })
    }
    const price = (await getPremiumSettings()).prices[plan]
    if (price === null) return NextResponse.json({ error: 'Ese plan no está a la venta' }, { status: 400 })

    const origin = appOrigin(req)
    const user = await db.user.findUnique({
      where: { id: viewer.userId },
      select: { id: true, email: true, emailVerified: true, stripeCustomerId: true },
    })
    if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

    if (method === 'card') {
      if (!stripePlanAvailable(plan)) {
        return NextResponse.json({ error: 'El pago con tarjeta no está disponible para este plan' }, { status: 400 })
      }
      // Dos suscripciones de Stripe a la vez serían dos cobros por lo mismo
      if (await activeStripeSubscription(user.id)) {
        return NextResponse.json(
          { error: 'Ya tienes una suscripción con tarjeta activa. Gestiónala desde "Facturación".' },
          { status: 409 }
        )
      }
      const url = await createStripeCheckout({ user, plan, priceUsd: price, origin })
      return NextResponse.json({ url })
    }

    if (!nowpaymentsConfigured()) {
      return NextResponse.json({ error: 'El pago en cripto no está disponible ahora mismo' }, { status: 400 })
    }
    // El pago se registra antes de crear la factura: su id viaja como order_id
    // y es lo que la notificación de NOWPayments nos devuelve.
    const payment = await db.payment.create({
      data: { userId: user.id, provider: 'nowpayments', plan, amountUsd: price, status: 'waiting' },
    })
    try {
      const invoice = await createNowInvoice({
        orderId: payment.id,
        amountUsd: price,
        description: `Cabal Premium · ${PLANS[plan].label}`,
        ipnUrl: `${origin}/api/webhooks/nowpayments`,
        successUrl: `${origin}/app?premium=crypto`,
        cancelUrl: `${origin}/app?premium=cancel`,
      })
      await db.payment.update({
        where: { id: payment.id },
        data: { externalId: invoice.id, invoiceUrl: invoice.url },
      })
      return NextResponse.json({ url: invoice.url })
    } catch (e) {
      await db.payment.delete({ where: { id: payment.id } }).catch(() => {})
      throw e
    }
  } catch (e) {
    console.error('[premium] checkout', e)
    return NextResponse.json({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' }, { status: 502 })
  }
}
