import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getReferralPercent } from '@/lib/api-helpers'

// GET /api/me/affiliates — personas que se registraron con mi enlace y los
// puntos que me ha dejado cada una.
export async function GET() {
  try {
    const me = await getCurrentUser()

    const [affiliates, bySource, total, percent] = await Promise.all([
      db.user.findMany({
        where: { referredById: me.id },
        select: { id: true, handle: true, name: true, avatar: true, xHandle: true, lifetimePoints: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      db.pointEvent.groupBy({
        by: ['sourceUserId'],
        where: { userId: me.id, reason: 'referral', sourceUserId: { not: null } },
        _sum: { amount: true },
      }),
      db.pointEvent.aggregate({ where: { userId: me.id, reason: 'referral' }, _sum: { amount: true } }),
      getReferralPercent(),
    ])
    const earnedBy = new Map(bySource.map((r) => [r.sourceUserId, r._sum.amount ?? 0]))

    return NextResponse.json({
      code: me.referralCode ?? '',
      percent,
      totalEarned: total._sum.amount ?? 0,
      affiliates: affiliates.map((a) => ({
        id: a.id,
        handle: a.handle,
        name: a.name,
        avatar: a.avatar,
        xHandle: a.xHandle,
        points: a.lifetimePoints,
        earnedForMe: earnedBy.get(a.id) ?? 0,
        joinedAt: a.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
