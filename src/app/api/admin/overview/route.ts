import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import type { AdminOverviewDTO } from '@/lib/types'

export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const [users, postCount, launchCount, tokenCount, pointsAgg, events, distribution, redeemCount] =
      await Promise.all([
        db.user.findMany({ orderBy: { points: 'desc' } }),
        db.post.count(),
        db.launch.count(),
        db.token.count(),
        db.user.aggregate({ _sum: { points: true, lifetimePoints: true } }),
        db.pointEvent.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 15 }),
        db.pointEvent.groupBy({ by: ['reason'], _sum: { amount: true } }),
        db.pointEvent.count({ where: { reason: 'redeem' } }),
      ])

    const dto: AdminOverviewDTO = {
      totalUsers: users.length,
      totalPosts: postCount,
      totalLaunches: launchCount,
      totalTokens: tokenCount,
      pointsInCirculation: pointsAgg._sum.points ?? 0,
      pointsIssuedTotal: pointsAgg._sum.lifetimePoints ?? 0,
      pendingRedeems: redeemCount,
      topEarners: users.slice(0, 5).map((u) => ({ user: toUserDTO(u), points: u.points })),
      recentEvents: events.map((e) => ({
        id: e.id,
        amount: e.amount,
        reason: e.reason,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
        user: toUserDTO(e.user),
      })),
      distribution: distribution.map((d) => ({ reason: d.reason, total: d._sum.amount ?? 0 })),
    }
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
