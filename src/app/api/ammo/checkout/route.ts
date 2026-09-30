import { NextResponse } from 'next/server'
import { blockIosAppPurchase } from '@/lib/native-app'
import { db } from '@/lib/db'
import { appOrigin } from '@/lib/oauth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { getViewer } from '@/lib/premium'
import { PACKS, getAmmoSettings, isPackKey, priceToCharge } from '@/lib/ammo'
import { createAmmoCheckout, stripeAmmoAvailable } from '@/lib/stripe'
import { createNowInvoice, nowpaymentsConfigured } from '@/lib/nowpayments'

/**
 * POST /api/ammo/checkout — { pack, method: 'card' | 'crypto' }
 * Devuelve { url } de la pasarela. Las balas se acreditan cuando el proveedor
 * confirma el pago (webhook), nunca al pulsar el botón.
 */
export async function POST(req: Request) {
  const blocked = blockIosAppPurchase(req)
  if (blocked) return blocked
  try {
    const viewer = await getViewer(req)
    if (!viewer.userId) {
      return NextResponse.json({ error: 'Inicia sesión para comprar munición' }, { status: 401 })
    }
    const limit = await rateLimit(`ammo-checkout:${viewer.userId}`, 10, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const pack = body.pack
    const method = body.method === 'crypto' ? 'crypto' : body.method === 'card' ? 'card' : null
    if (!isPackKey(pack) || !method) {
      return NextResponse.json({ error: 'Cargador o método de pago no válido' }, { status: 400 })
    }
    const settings = await getAmmoSettings()
    const listPrice = settings.prices[pack]
    if (listPrice === null || listPrice === undefined) {
      return NextResponse.json({ error: 'Ese cargador no está a la venta' }, { status: 400 })
    }
    // El descuento se aplica aquí, no solo en la pantalla: si no, el cliente
    // vería la promo y luego pagaría el precio entero.
    const price = priceToCharge(listPrice, settings)
    const { label, bullets } = PACKS[pack]

    const origin = appOrigin(req)
    const user = await db.user.findUnique({
      where: { id: viewer.userId },
      select: { id: true, email: true, emailVerified: true, stripeCustomerId: true },
    })
    if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

    if (method === 'card') {
      if (!stripeAmmoAvailable()) {
        return NextResponse.json({ error: 'El pago con tarjeta no está disponible para la munición' }, { status: 400 })
      }
      const url = await createAmmoCheckout({ user, packKey: pack, label, bullets, priceUsd: price, origin })
      return NextResponse.json({ url })
    }

    if (!nowpaymentsConfigured()) {
      return NextResponse.json({ error: 'El pago en cripto no está disponible ahora mismo' }, { status: 400 })
    }
    // El pago se registra antes de crear la factura: su id viaja como order_id
    // y es lo que la notificación de NOWPayments nos devuelve.
    const payment = await db.payment.create({
      data: { userId: user.id, provider: 'nowpayments', plan: `ammo_${pack}`, amountUsd: price, status: 'waiting' },
    })
    try {
      const invoice = await createNowInvoice({
        orderId: payment.id,
        amountUsd: price,
        description: `Cabal · ${label} (${bullets} balas)`,
        ipnUrl: `${origin}/api/webhooks/nowpayments`,
        successUrl: `${origin}/app?ammo=crypto`,
        cancelUrl: `${origin}/app?ammo=cancel`,
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
    console.error('[ammo] checkout', e)
    return NextResponse.json({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' }, { status: 502 })
  }
}
