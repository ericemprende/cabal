import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import type { AdminUserRowDTO } from '@/lib/types'

export async function GET() {
  try {
    await requireAdmin()
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
