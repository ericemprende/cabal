import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, getCurrentUser } from '@/lib/api-helpers'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await getCurrentUser()
    const existing = await db.vote.findUnique({
      where: { userId_target_targetId: { userId: me.id, target: 'launch', targetId: id } },
    })
    if (existing) {
      await db.$transaction([
        db.vote.delete({ where: { id: existing.id } }),
        db.launch.update({ where: { id }, data: { hype: { decrement: 1 } } }),
      ])
      const launch = await db.launch.findUnique({ where: { id } })
      return NextResponse.json({ ok: true, hyped: false, hype: launch?.hype ?? 0 })
    }
    await db.$transaction([
      db.vote.create({ data: { userId: me.id, target: 'launch', targetId: id } }),
      db.launch.update({ where: { id }, data: { hype: { increment: 1 } } }),
    ])
    const launch = await db.launch.findUnique({ where: { id } })
    // reward launch creator with hype_received points (not self)
    if (launch && launch.createdById !== me.id) {
      await awardPoints(launch.createdById, 'hype_received', `Hype recibido en ${launch.ticker}`)
    }
    return NextResponse.json({ ok: true, hyped: true, hype: launch?.hype ?? 0 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
