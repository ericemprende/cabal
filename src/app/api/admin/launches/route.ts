import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { NETWORKS } from '@/lib/cabal'
import { toUserDTO } from '@/lib/serializers'
import { invalidate } from '@/lib/cache'
import type { LaunchDTO } from '@/lib/types'

const safeUrl = (v: unknown) =>
  typeof v === 'string' && (v.startsWith('/uploads/') || v.startsWith('/seed/') || v.startsWith('https://'))
    ? v.slice(0, 500)
    : null

const safeContract = (v: unknown) =>
  typeof v === 'string' && /^[a-zA-Z0-9:_-]{2,80}$/.test(v.trim()) ? v.trim() : null

const safeWallet = (v: unknown) =>
  typeof v === 'string' && /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(v.trim()) ? v.trim() : null

const safeLaunchpad = (v: unknown) =>
  typeof v === 'string' && /^[\p{L}\p{N} ._-]{2,40}$/u.test(v.trim()) ? v.trim() : null

// GET: lista completa para el admin (incluye launches ocultos, ticker real de privados)
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
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
      hidden: l.hidden,
      submitterRole: l.submitterRole === 'dev' ? 'dev' : 'community',
      contract: l.contract,
      devWallet: l.devWallet,
      launchpad: l.launchpad,
      lockedFields: [],
      network: l.network,
      launchAt: l.launchAt.toISOString(),
      dateConfirmed: l.dateConfirmed,
      description: l.description,
      website: l.website,
      twitter: l.twitter,
      telegram: l.telegram,
      isLive: l.isLive,
      liveUrl: l.liveUrl,
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

// PATCH: el admin corrige cualquier dato de un launch (redes, contrato, visibilidad, rol del que sube, etc.)
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req)
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
    // Solo redes soportadas; cualquier otro valor no toca el campo (evita redes corruptas)
    if (typeof body.network === 'string' && body.network in NETWORKS) data.network = body.network
    if (typeof body.launchAt === 'string' && body.launchAt) {
      const when = new Date(body.launchAt)
      if (isNaN(when.getTime())) {
        return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
      }
      data.launchAt = when
    }
    if (typeof body.dateConfirmed === 'boolean') data.dateConfirmed = body.dateConfirmed
    if (typeof body.description === 'string') data.description = body.description.slice(0, 800)
    // Redes sociales / enlaces del proyecto (editables desde el panel)
    if ('website' in body) data.website = safeUrl(body.website)
    if ('twitter' in body) data.twitter = safeUrl(body.twitter)
    if ('telegram' in body) data.telegram = safeUrl(body.telegram)
    if ('image' in body) data.image = safeUrl(body.image)
    if ('banner' in body) data.banner = safeUrl(body.banner)
    if ('contract' in body) data.contract = safeContract(body.contract)
    if ('devWallet' in body) data.devWallet = safeWallet(body.devWallet)
    if ('launchpad' in body) data.launchpad = safeLaunchpad(body.launchpad)
    // Streaming en vivo: toggle + link del stream (YouTube, Twitch, Vimeo…)
    if (typeof body.isLive === 'boolean') data.isLive = body.isLive
    if ('liveUrl' in body) data.liveUrl = body.isLive === false ? null : safeUrl(body.liveUrl)
    if (typeof body.isPrivate === 'boolean') data.isPrivate = body.isPrivate
    if (typeof body.hidden === 'boolean') data.hidden = body.hidden
    if (body.submitterRole === 'dev' || body.submitterRole === 'community') {
      data.submitterRole = body.submitterRole
    }
    for (const flag of ['lpLocked', 'mintRevoked'] as const) {
      if (typeof body[flag] === 'boolean') data[flag] = body[flag]
    }
    if (typeof body.top10Pct === 'number' && body.top10Pct >= 0 && body.top10Pct <= 100) {
      data.top10Pct = body.top10Pct
    }

    const updated = await db.launch.update({ where: { id }, data })
    // La lista del Radar está cacheada: sin esto el cambio tardaría hasta un minuto
    await invalidate('launches:*')
    return NextResponse.json({ ok: true, launch: { id: updated.id, hidden: updated.hidden } })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// DELETE: elimina el launch y limpia sus dependencias (posts quedan como comentarios sueltos)
export async function DELETE(req: Request) {
  try {
    await requireAdmin(req)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const target = await db.launch.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'Launch no encontrado' }, { status: 404 })
    await db.$transaction([
      db.vote.deleteMany({ where: { target: 'launch', targetId: id } }),
      db.post.updateMany({ where: { launchId: id }, data: { launchId: null } }),
      db.launch.delete({ where: { id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
