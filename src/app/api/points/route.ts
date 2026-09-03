import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getPointRules } from '@/lib/api-helpers'
import type { PointEventDTO } from '@/lib/types'

export async function GET() {
  try {
    const me = await getCurrentUser()
    const [events, rank, rules] = await Promise.all([
      db.pointEvent.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      db.user.count({ where: { points: { gt: me.points } } }),
      getPointRules(),
    ])
    const dto = {
      points: me.points,
      lifetimePoints: me.lifetimePoints,
      rank: rank + 1,
      rules,
      events: events.map(
        (e): PointEventDTO => ({
          id: e.id,
          amount: e.amount,
          reason: e.reason,
          note: e.note,
          createdAt: e.createdAt.toISOString(),
        })
      ),
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
