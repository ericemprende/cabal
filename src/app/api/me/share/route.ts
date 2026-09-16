import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { awardPoints } from '@/lib/api-helpers'
import { localeFromHeader, shareRuleAmount, shareVariants } from '@/lib/waitlist'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/share
 * El post "ya estoy dentro" para quien se registró en la app (no por la
 * whitelist): mismo texto y tarjeta que la lista, con su @usuario de Cabal.
 */
export async function GET() {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
  const user = await db.user.findUnique({ where: { id: userId }, select: { handle: true } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const shared = await db.pointEvent.findFirst({ where: { userId, reason: 'share_x' }, select: { id: true } })
  return NextResponse.json({
    handle: user.handle,
    locale: localeFromHeader((await headers()).get('accept-language')),
    share: shareVariants(user.handle, userId),
    shareBonus: await shareRuleAmount(),
    shared: Boolean(shared),
  })
}

/**
 * POST /api/me/share
 * Abre el compositor de X → abona el bonus por difundir, una sola vez por
 * cuenta (el mismo `share_x` que da la whitelist, así nadie cobra dos veces).
 */
export async function POST() {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })

  const prior = await db.pointEvent.findFirst({ where: { userId, reason: 'share_x' }, select: { id: true } })
  if (prior) return NextResponse.json({ ok: true, pointsEarned: 0 })

  const pointsEarned = await awardPoints(
    userId,
    'share_x',
    'Compartió su tarjeta de Cabal.army en X',
    await shareRuleAmount()
  )
  return NextResponse.json({ ok: true, pointsEarned })
}
