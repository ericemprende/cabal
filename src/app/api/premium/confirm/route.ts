import { NextResponse } from 'next/server'
import { getViewer, premiumStatus } from '@/lib/premium'
import { stripe, stripeConfigured, syncStripeSubscription } from '@/lib/stripe'

/**
 * POST /api/premium/confirm — { sessionId }
 * Al volver de Stripe Checkout, lee la sesión y activa la suscripción sin
 * esperar al webhook: el usuario ve su Premium al instante aunque el aviso de
 * Stripe se retrase (o el webhook aún no esté configurado).
 */
export async function POST(req: Request) {
  try {
    const viewer = await getViewer(req)
    if (!viewer.userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    if (!stripeConfigured()) return NextResponse.json({ error: 'Stripe no está configurado' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      return NextResponse.json({ error: 'Sesión de pago no válida' }, { status: 400 })
    }

    const session = await stripe().checkout.sessions.retrieve(sessionId)
    // Solo la cuenta que abrió el pago puede confirmarlo
    if (session.client_reference_id !== viewer.userId) {
      return NextResponse.json({ error: 'Ese pago no es de tu cuenta' }, { status: 403 })
    }
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    if (session.status === 'complete' && subId) {
      const sub = await stripe().subscriptions.retrieve(subId)
      await syncStripeSubscription(sub, new Date(), viewer.userId)
    }
    return NextResponse.json({ status: await premiumStatus(viewer.userId, viewer.isAdmin) })
  } catch (e) {
    console.error('[premium] confirm', e)
    return NextResponse.json({ error: 'No se pudo confirmar el pago todavía' }, { status: 502 })
  }
}
