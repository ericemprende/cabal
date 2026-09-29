import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { buildCreatorClaimTx } from '@/lib/cabal-launch'

export const runtime = 'nodejs'

/**
 * POST /api/pump/claim — { mint }: transacción para que el dev reclame sus
 * comisiones (el 70 %) de un token de Cabal Launch. La firma su wallet: las
 * comisiones van a la wallet con la que lo creó.
 */
export async function POST(req: Request) {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
  const limit = await rateLimit(`pump-claim:${userId}`, 20, 600)
  if (!limit.ok) return tooManyRequests(limit)

  const { mint } = (await req.json().catch(() => ({}))) as { mint?: string }
  const coin = mint ? await db.pumpCoin.findUnique({ where: { mint } }) : null
  if (!coin || coin.userId !== userId) return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 })
  if (coin.platform !== 'cabal' || coin.status !== 'launched') {
    return NextResponse.json({ error: 'Solo los tokens de Cabal Launch reparten comisiones al dev' }, { status: 400 })
  }
  try {
    const tx = await buildCreatorClaimTx(coin.creatorWallet, coin.mint)
    return NextResponse.json({ ok: true, tx, creatorWallet: coin.creatorWallet })
  } catch (e) {
    console.error('[pump/claim]', e)
    return NextResponse.json({ error: 'No se pudo preparar el cobro. Inténtalo de nuevo.' }, { status: 500 })
  }
}
