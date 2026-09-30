import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSessionUser, errorStatus } from '@/lib/api-helpers'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await requireSessionUser()
    if (id === me.id) return NextResponse.json({ error: 'No puedes seguirte a ti mismo' }, { status: 400 })
    const existing = await db.follow.findUnique({
      where: { userId_targetId: { userId: me.id, targetId: id } },
    })
    if (existing) {
      await db.$transaction([
        db.follow.delete({ where: { id: existing.id } }),
        db.user.update({ where: { id }, data: { followers: { decrement: 1 } } }),
      ])
      return NextResponse.json({ ok: true, following: false })
    }
    await db.$transaction([
      db.follow.create({ data: { userId: me.id, targetId: id } }),
      db.user.update({ where: { id }, data: { followers: { increment: 1 } } }),
    ])
    return NextResponse.json({ ok: true, following: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: errorStatus(e) })
  }
}
