import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { coinExistsOnChain, sendCreateTxs } from '@/lib/pump-launch'
import { markLaunched } from '@/lib/pump-schedule'

export const runtime = 'nodejs'

/**
 * POST /api/pump/confirm — lanzamiento al momento: recibe las transacciones
 * firmadas (creador + mint), las manda a la red y, cuando el token existe en
 * pump.fun, lo publica en el Radar como launch del creador. Body: { mint, txs }.
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
  if (coin.status === 'launched') return NextResponse.json({ ok: true, mint, launchId: coin.launchId })
  if (coin.status !== 'draft') return NextResponse.json({ error: 'Este token está programado' }, { status: 409 })

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

  const launchId = await markLaunched(coin, signature)
  return NextResponse.json({ ok: true, mint, signature, buyError, launchId })
}
