import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { awardPoints } from '@/lib/api-helpers'
import { invalidate } from '@/lib/cache'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { coinExistsOnChain, sendCreateTxs } from '@/lib/pump-launch'
import { createTokenForLaunch } from '@/lib/tokens-sync'

export const runtime = 'nodejs'

/**
 * POST /api/pump/confirm — recibe la transacción firmada (creador + mint), la
 * manda a la red y, cuando el token existe en pump.fun, lo publica en el
 * Radar como launch del creador. Body: { mint, tx }.
 */
export async function POST(req: Request) {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
  const limit = await rateLimit(`pump-confirm:${userId}`, 10, 600)
  if (!limit.ok) return tooManyRequests(limit)

  const { mint, txs } = (await req.json().catch(() => ({}))) as { mint?: string; txs?: string[] }
  if (!mint || !Array.isArray(txs) || !txs.length) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const coin = await db.pumpCoin.findUnique({ where: { mint } })
  if (!coin || coin.userId !== userId) return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 })
  if (coin.launchedAt) return NextResponse.json({ ok: true, mint, launchId: coin.launchId })

  let signature: string | null = null
  let buyError: string | null = null
  try {
    ;({ signature, buyError } = await sendCreateTxs(txs, mint, coin.creatorWallet))
  } catch (e) {
    console.error('[pump/confirm] send', e)
    // Pudo confirmarse aunque la espera fallara (red lenta): se mira en la red
    if (!(await coinExistsOnChain(mint).catch(() => false))) {
      return NextResponse.json(
        { error: 'La transacción no se confirmó. Revisa tu saldo de SOL e inténtalo de nuevo.' },
        { status: 502 },
      )
    }
  }

  const now = new Date()
  const launch = await db.launch.create({
    data: {
      name: coin.name,
      ticker: coin.symbol,
      image: coin.image,
      submitterRole: 'dev',
      contract: mint,
      devWallet: coin.creatorWallet,
      launchpad: 'pump.fun',
      network: 'solana',
      launchAt: now,
      dateConfirmed: true,
      description: coin.description || `${coin.name} ($${coin.symbol}), lanzado en pump.fun desde Cabal.`,
      website: coin.website,
      twitter: coin.twitter,
      telegram: coin.telegram,
      createdById: userId,
    },
  })
  await db.pumpCoin.update({ where: { mint }, data: { launchedAt: now, signature, launchId: launch.id } })
  const pointsEarned = await awardPoints(userId, 'launch', `Lanzaste ${coin.name} ($${coin.symbol}) en pump.fun`)
  await createTokenForLaunch(launch).catch((e) => console.error('[pump/confirm] token', e))
  await invalidate('launches:*')

  return NextResponse.json({ ok: true, mint, signature, buyError, launchId: launch.id, pointsEarned })
}
