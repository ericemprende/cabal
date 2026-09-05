import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getPointRules } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import type { MeDTO } from '@/lib/types'

export async function GET() {
  try {
    const me = await getCurrentUser()
    const [followed, pointEvents, rules, postCount, launchCount, hypes, likesReceived] =
      await Promise.all([
        db.follow.findMany({ where: { userId: me.id } }),
        db.pointEvent.findMany({
          where: { userId: me.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        getPointRules(),
        db.post.count({ where: { userId: me.id } }),
        db.launch.count({ where: { createdById: me.id } }),
        db.vote.count({ where: { userId: me.id, target: 'launch' } }),
        db.post.aggregate({ where: { userId: me.id }, _sum: { likes: true } }),
      ])
    const followedIds = new Set(followed.map((f) => f.targetId))

    // rank by points
    const pointsRank = (await db.user.count({ where: { points: { gt: me.points } } })) + 1

    const dto: MeDTO = {
      ...toUserDTO(me, followedIds.has(me.id)),
      isAdmin: me.isAdmin,
      pointsRank,
      pointEvents: pointEvents.map((e) => ({
        id: e.id,
        amount: e.amount,
        reason: e.reason,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
      pointRules: rules,
      stats: {
        postsCount: postCount,
        launchesCount: launchCount,
        hypesGiven: hypes,
        likesReceived: likesReceived._sum.likes ?? 0,
      },
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await getCurrentUser()
    const body = await req.json()
    const data: Record<string, string | boolean> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 40)
    if (typeof body.bio === 'string') data.bio = body.bio.slice(0, 200)
    // Avatar: emoji corto O URL de imagen (https://, /uploads/, /seed/)
    if (typeof body.avatar === 'string') {
      const a = body.avatar.trim()
      const isUrl = /^https:\/\/\S+$/i.test(a) || a.startsWith('/uploads/') || a.startsWith('/seed/')
      if (isUrl && a.length <= 500) data.avatar = a
      else if (!isUrl && a.length > 0 && a.length <= 8) data.avatar = a
    }
    if (typeof body.wallet === 'string') {
      const w = body.wallet.trim()
      data.wallet = w.length >= 20 ? w : null
      if (w.length >= 20 && !me.walletVerified) data.walletVerified = true
    }
    const updated = await db.user.update({ where: { id: me.id }, data })
    return NextResponse.json({ ok: true, user: toUserDTO(updated) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
