import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { buildCreateTxs } from '@/lib/pump-launch'
import { parsePumpForm } from '@/lib/pump-input'

export const runtime = 'nodejs'

/**
 * POST /api/pump/prepare — guarda el metadata del token y devuelve las
 * transacciones de creación sin firmar (base64) para que las firme el creador.
 * Body: { mint, creator, name, symbol, description, image, twitter, telegram,
 * website, initialBuySol }.
 */
export async function POST(req: Request) {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json({ error: 'Inicia sesión para lanzar un token' }, { status: 401 })
  const limit = await rateLimit(`pump-prepare:${userId}`, 10, 600)
  if (!limit.ok) return tooManyRequests(limit)

  try {
    const parsed = parsePumpForm((await req.json()) as Record<string, unknown>)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { mint, creator, ...data } = parsed.data

    const existing = await db.pumpCoin.findUnique({ where: { mint } })
    if (existing && (existing.userId !== userId || existing.status !== 'draft' || existing.feeSignature)) {
      return NextResponse.json({ error: 'Esa dirección de token ya está usada' }, { status: 409 })
    }
    const fields = { ...data, creatorWallet: creator }
    await db.pumpCoin.upsert({ where: { mint }, create: { mint, userId, ...fields }, update: fields })

    const { txs, feeSol } = await buildCreateTxs({ mint, creator, ...data })
    return NextResponse.json({ ok: true, txs, feeSol })
  } catch (e) {
    console.error('[pump/prepare]', e)
    return NextResponse.json({ error: 'No se pudo preparar el lanzamiento. Inténtalo de nuevo.' }, { status: 500 })
  }
}
