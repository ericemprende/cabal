import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import type { LaunchDTO } from '@/lib/types'

const safeUrl = (v: unknown) =>
  typeof v === 'string' && (v.startsWith('/uploads/') || v.startsWith('/seed/') || v.startsWith('https://'))
    ? v.slice(0, 500)
    : null

// GET: lista completa para el admin (ticker real incluso en launches privados)
export async function GET() {
  try {
    await requireAdmin()
    const launches = await db.launch.findMany({
      include: { createdBy: true },
      orderBy: { launchAt: 'asc' },
    })
    const dto: LaunchDTO[] = launches.map((l) => ({
      id: l.id,
      name: l.name,
      ticker: l.ticker,
      emoji: l.emoji,
      image: l.image,
      banner: l.banner,
      isPrivate: l.isPrivate,
      network: l.network,
      launchAt: l.launchAt.toISOString(),
      description: l.description,
      website: l.website,
      twitter: l.twitter,
      telegram: l.telegram,
      status: l.status,
      hype: l.hype,
      hyped: false,
      lpLocked: l.lpLocked,
      mintRevoked: l.mintRevoked,
      top10Pct: l.top10Pct,
      createdAt: l.createdAt.toISOString(),
      createdBy: toUserDTO(l.createdBy),
      postsCount: 0,
    }))
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// PATCH: el admin corrige cualquier dato de un launch (nombre, ticker, fecha, red, imágenes, privacidad, safety)
export async function PATCH(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { id } = body
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }
    const target = await db.launch.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'Launch no encontrado' }, { status: 404 })

    const data: Record<string, string | boolean | number | Date | null> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 60)
    if ('ticker' in body) {
      const t = typeof body.ticker === 'string' ? body.ticker.trim().slice(0, 12).toUpperCase() : ''
      data.ticker = t || null
    }
    if (typeof body.network === 'string' && body.network) data.network = body.network
    if (typeof body.launchAt === 'string' && body.launchAt) {
      const when = new Date(body.launchAt)
      if (isNaN(when.getTime())) {
        return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
      }
      data.launchAt = when
    }
    if (typeof body.description === 'string') data.description = body.description.slice(0, 800)
    if ('website' in body) data.website = safeUrl(body.website)
    if ('twitter' in body) data.twitter = safeUrl(body.twitter)
    if ('telegram' in body) data.telegram = safeUrl(body.telegram)
    if ('image' in body) data.image = safeUrl(body.image)
    if ('banner' in body) data.banner = safeUrl(body.banner)
    if (typeof body.isPrivate === 'boolean') data.isPrivate = body.isPrivate
    for (const flag of ['lpLocked', 'mintRevoked'] as const) {
      if (typeof body[flag] === 'boolean') data[flag] = body[flag]
    }
    if (typeof body.top10Pct === 'number' && body.top10Pct >= 0 && body.top10Pct <= 100) {
      data.top10Pct = body.top10Pct
    }

    const updated = await db.launch.update({ where: { id }, data })
    return NextResponse.json({ ok: true, launch: { id: updated.id, ticker: updated.ticker } })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
