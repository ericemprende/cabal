import { NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { PUMP_LIMITS, buildCreateTxs } from '@/lib/pump-launch'
import { siteUrl } from '@/lib/waitlist'

export const runtime = 'nodejs'

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function pubkey(v: unknown): string | null {
  if (typeof v !== 'string') return null
  try {
    return new PublicKey(v).toBase58()
  } catch {
    return null
  }
}

function link(v: unknown): string | null {
  const s = str(v, 300)
  if (!s) return null
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

/**
 * POST /api/pump/prepare — guarda el metadata del token y devuelve la
 * transacción de creación sin firmar (base64) para que la firme el creador.
 * Body: { mint, creator, name, symbol, description, image, twitter, telegram,
 * website, initialBuySol }.
 */
export async function POST(req: Request) {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json({ error: 'Inicia sesión para lanzar un token' }, { status: 401 })
  const limit = await rateLimit(`pump-prepare:${userId}`, 10, 600)
  if (!limit.ok) return tooManyRequests(limit)

  try {
    const body = (await req.json()) as Record<string, unknown>
    const mint = pubkey(body.mint)
    const creator = pubkey(body.creator)
    const name = str(body.name, PUMP_LIMITS.name)
    const symbol = str(body.symbol, PUMP_LIMITS.symbol).replace(/^\$/, '').toUpperCase()
    const description = str(body.description, PUMP_LIMITS.description)
    let image = str(body.image, 500)
    const initialBuySol = Math.max(0, Number(body.initialBuySol) || 0)

    if (!mint || !creator) return NextResponse.json({ error: 'Falta la wallet o la dirección del token' }, { status: 400 })
    if (!name || !symbol) return NextResponse.json({ error: 'El nombre y el ticker son obligatorios' }, { status: 400 })
    if (!image) return NextResponse.json({ error: 'Sube la imagen del token' }, { status: 400 })
    if (initialBuySol > PUMP_LIMITS.maxInitialBuySol) {
      return NextResponse.json({ error: `La compra inicial máxima es ${PUMP_LIMITS.maxInitialBuySol} SOL` }, { status: 400 })
    }
    if (image.startsWith('/')) image = `${siteUrl()}${image}`
    if (!/^https:\/\//i.test(image)) return NextResponse.json({ error: 'La imagen no es válida' }, { status: 400 })

    const existing = await db.pumpCoin.findUnique({ where: { mint } })
    if (existing && (existing.userId !== userId || existing.launchedAt)) {
      return NextResponse.json({ error: 'Esa dirección de token ya está usada' }, { status: 409 })
    }

    const data = {
      name,
      symbol,
      description,
      image,
      twitter: link(body.twitter),
      telegram: link(body.telegram),
      website: link(body.website),
      creatorWallet: creator,
      initialBuySol,
    }
    await db.pumpCoin.upsert({ where: { mint }, create: { mint, userId, ...data }, update: data })

    const { txs, feeSol } = await buildCreateTxs({ mint, creator, name, symbol, initialBuySol })
    return NextResponse.json({ ok: true, txs, feeSol })
  } catch (e) {
    console.error('[pump/prepare]', e)
    return NextResponse.json({ error: 'No se pudo preparar el lanzamiento. Inténtalo de nuevo.' }, { status: 500 })
  }
}
