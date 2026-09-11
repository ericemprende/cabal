import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appOrigin } from '@/lib/oauth'
import { getViewer } from '@/lib/premium'
import { stripe, stripeConfigured } from '@/lib/stripe'

/**
 * POST /api/premium/portal — URL del portal de facturación de Stripe (cancelar,
 * cambiar la tarjeta, descargar facturas). Requiere haber pagado con tarjeta.
 */
export async function POST(req: Request) {
  try {
    const viewer = await getViewer(req)
    if (!viewer.userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    if (!stripeConfigured()) return NextResponse.json({ error: 'Stripe no está configurado' }, { status: 400 })

    const user = await db.user.findUnique({ where: { id: viewer.userId }, select: { stripeCustomerId: true } })
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: 'No tienes pagos con tarjeta que gestionar' }, { status: 400 })
    }
    const session = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appOrigin(req)}/app?premium=portal`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[premium] portal', e)
    return NextResponse.json({ error: 'No se pudo abrir la facturación' }, { status: 502 })
  }
}
