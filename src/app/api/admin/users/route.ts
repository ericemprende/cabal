import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import type { AdminUserRowDTO } from '@/lib/types'

export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const users = await db.user.findMany({ orderBy: { points: 'desc' } })
    const [postCounts, launchCounts, likeSums, lastEvents] = await Promise.all([
      db.post.groupBy({ by: ['userId'], _count: { _all: true } }),
      db.launch.groupBy({ by: ['createdById'], _count: { _all: true } }),
      db.post.groupBy({ by: ['userId'], _sum: { likes: true } }),
      db.pointEvent.groupBy({ by: ['userId'], _max: { createdAt: true } }),
    ])
    const postMap = new Map(postCounts.map((p) => [p.userId, p._count._all]))
    const launchMap = new Map(launchCounts.map((l) => [l.createdById, l._count._all]))
    const likeMap = new Map(likeSums.map((l) => [l.userId, l._sum.likes ?? 0]))
    const lastMap = new Map(lastEvents.map((l) => [l.userId, l._max.createdAt]))

    const rows: AdminUserRowDTO[] = users.map((u) => ({
      ...toUserDTO(u),
      postsCount: postMap.get(u.id) ?? 0,
      launchesCount: launchMap.get(u.id) ?? 0,
      likesReceived: likeMap.get(u.id) ?? 0,
      lastActivity: lastMap.get(u.id)?.toISOString() ?? null,
    }))
    return NextResponse.json(rows)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// PATCH: el admin edita perfiles (nombre, handle, redes sociales, badges, roles)
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json()
    const { id } = body
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }
    const target = await db.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const data: Record<string, string | boolean | null> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 40)
    if (typeof body.handle === 'string' && body.handle.trim()) {
      const handle = body.handle.trim().replace(/^@+/, '').toLowerCase()
      if (!/^[\w.]{2,20}$/.test(handle)) {
        return NextResponse.json({ error: 'Handle inválido' }, { status: 400 })
      }
      if (handle !== target.handle) {
        const exists = await db.user.findUnique({ where: { handle } })
        if (exists) return NextResponse.json({ error: 'Ese handle ya existe' }, { status: 400 })
        data.handle = handle
      }
    }
    if (typeof body.bio === 'string') data.bio = body.bio.slice(0, 200)
    const cleanHandle = (v: unknown) =>
      typeof v === 'string' ? v.trim().replace(/^@+/, '').slice(0, 30) || null : null
    if ('xHandle' in body) {
      data.xHandle = cleanHandle(body.xHandle)
      if (data.xHandle === null) data.xVerified = false
    }
    if ('tgHandle' in body) data.tgHandle = cleanHandle(body.tgHandle)
    if ('googleEmail' in body) {
      const email = typeof body.googleEmail === 'string' ? body.googleEmail.trim().toLowerCase() : ''
      data.googleEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null
      if (data.googleEmail === null) data.googleVerified = false
    }
    for (const flag of ['walletVerified', 'xVerified', 'googleVerified', 'isDev', 'isAdmin'] as const) {
      if (typeof body[flag] === 'boolean') data[flag] = body[flag]
    }
    // Evita que el admin se quite su propio rol
    if (data.isAdmin === false && target.isAdmin && target.isCurrentUser) {
      return NextResponse.json({ error: 'No puedes quitarte tu propio rol de admin' }, { status: 400 })
    }

    const updated = await db.user.update({ where: { id }, data })
    return NextResponse.json({ ok: true, user: toUserDTO(updated) })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
