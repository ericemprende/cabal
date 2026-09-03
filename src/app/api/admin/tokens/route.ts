import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import type { TokenDTO } from '@/lib/types'

const safeUrl = (v: unknown) =>
  typeof v === 'string' && (v.startsWith('/uploads/') || v.startsWith('/seed/') || v.startsWith('https://'))
    ? v.slice(0, 500)
    : null

// GET: lista completa de tokens para el admin
export async function GET() {
  try {
    await requireAdmin()
    const tokens = await db.token.findMany({ include: { dev: true }, orderBy: { mc: 'desc' } })
    const dto: TokenDTO[] = tokens.map((t) => ({
      id: t.id,
      name: t.name,
      ticker: t.ticker,
      emoji: t.emoji,
      image: t.image,
      network: t.network,
      price: t.price,
      mc: t.mc,
      change24h: t.change24h,
      volume24h: t.volume24h,
      holders: t.holders,
      top10Pct: t.top10Pct,
      contract: t.contract,
      launchedAt: t.launchedAt.toISOString(),
      athMc: t.athMc,
      isRug: t.isRug,
      dev: toUserDTO(t.dev),
      postsCount: 0,
    }))
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// PATCH: el admin edita tokens (nombre, ticker, logo/imagen, red, métricas, rug)
export async function PATCH(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { id } = body
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }
    const target = await db.token.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 })

    const data: Record<string, string | boolean | number | null> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 60)
    if (typeof body.ticker === 'string' && body.ticker.trim()) data.ticker = body.ticker.trim().slice(0, 12).toUpperCase()
    if (typeof body.network === 'string' && body.network) data.network = body.network
    if ('image' in body) data.image = safeUrl(body.image)
    if (typeof body.contract === 'string') data.contract = body.contract.slice(0, 80)
    if (typeof body.isRug === 'boolean') data.isRug = body.isRug
    for (const num of ['price', 'mc', 'change24h', 'volume24h', 'athMc'] as const) {
      if (typeof body[num] === 'number' && Number.isFinite(body[num]) && body[num] >= 0) data[num] = body[num]
    }
    for (const num of ['holders', 'top10Pct'] as const) {
      if (typeof body[num] === 'number' && Number.isInteger(body[num]) && body[num] >= 0) data[num] = body[num]
    }

    const updated = await db.token.update({ where: { id }, data })
    return NextResponse.json({ ok: true, token: { id: updated.id, ticker: updated.ticker, image: updated.image } })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
