import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { DONATION_PLAN, claimDonationShare, donationDTO } from '@/lib/donate-server'
import { localeFromHeader } from '@/lib/waitlist'

export const dynamic = 'force-dynamic'

/** La donación con su recibo, comprobando que sea de quien pregunta. */
async function ownDonation(userId: string, id: string) {
  const payment = await db.payment.findFirst({
    where: { id, userId, plan: DONATION_PLAN },
    select: { id: true, amountUsd: true, status: true, invoiceUrl: true },
  })
  if (!payment) return null
  const donation = await db.donation.findUnique({
    where: { paymentId: payment.id },
    select: { id: true, points: true, sharedAt: true },
  })
  return { payment, donation }
}

/**
 * GET /api/donate/<id> — estado de una donación propia y el post listo para X.
 *
 * La pantalla de gracias lo consulta cada pocos segundos mientras el pago no
 * está confirmado: en cripto la red puede tardar minutos, y los puntos entran
 * cuando la notificación del proveedor llega (ver lib/donate-server.ts).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUserIdFromCookies().catch(() => null)
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })

    const { id } = await ctx.params
    const found = await ownDonation(userId, id)
    if (!found) return NextResponse.json({ error: 'Donación no encontrada' }, { status: 404 })

    const user = await db.user.findUnique({ where: { id: userId }, select: { handle: true } })
    if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

    return NextResponse.json(
      await donationDTO({
        handle: user.handle,
        locale: localeFromHeader((await headers()).get('accept-language')),
        payment: found.payment,
        donation: found.donation,
      })
    )
  } catch (e) {
    console.error('[donate] estado', e)
    return NextResponse.json({ error: 'No se pudo leer la donación' }, { status: 500 })
  }
}

/**
 * POST /api/donate/<id> — abona el bonus por publicar la tarjeta de esa
 * donación en X. Una vez por donación y solo si el pago está confirmado: sin
 * eso bastaría con abrir una factura que nunca se paga para cobrar el bonus.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUserIdFromCookies().catch(() => null)
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })

    const { id } = await ctx.params
    const found = await ownDonation(userId, id)
    if (!found) return NextResponse.json({ error: 'Donación no encontrada' }, { status: 404 })
    if (!found.donation) {
      // Todavía sin confirmar: compartir está bien, el bonus espera al dinero.
      return NextResponse.json({ ok: false, pending: true, pointsEarned: 0, shared: false })
    }

    const res = await claimDonationShare(userId, found.donation.id)
    return NextResponse.json({ ok: true, pending: false, ...res })
  } catch (e) {
    console.error('[donate] compartir', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
