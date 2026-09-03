import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, getCurrentUser } from '@/lib/api-helpers'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await getCurrentUser()
    const post = await db.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 })
    const existing = await db.vote.findUnique({
      where: { userId_target_targetId: { userId: me.id, target: 'post', targetId: id } },
    })
    if (existing) {
      await db.$transaction([
        db.vote.delete({ where: { id: existing.id } }),
        db.post.update({ where: { id }, data: { likes: { decrement: 1 } } }),
      ])
      const updated = await db.post.findUnique({ where: { id } })
      return NextResponse.json({ ok: true, liked: false, likes: updated?.likes ?? 0 })
    }
    await db.$transaction([
      db.vote.create({ data: { userId: me.id, target: 'post', targetId: id } }),
      db.post.update({ where: { id }, data: { likes: { increment: 1 } } }),
    ])
    if (post.userId !== me.id) {
      await awardPoints(post.userId, 'like_received', 'Like recibido en tu post')
    }
    const updated = await db.post.findUnique({ where: { id } })
    return NextResponse.json({ ok: true, liked: true, likes: updated?.likes ?? 0 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
