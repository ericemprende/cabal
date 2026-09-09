import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, getCurrentUser } from '@/lib/api-helpers'
import { bump, pending } from '@/lib/counters'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { invalidate } from '@/lib/cache'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await getCurrentUser()

    const limit = await rateLimit(`like:${me.id ?? clientIp(req)}`, 60, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const post = await db.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 })

    const existing = await db.vote.findUnique({
      where: { userId_target_targetId: { userId: me.id, target: 'post', targetId: id } },
    })

    // Mismo patrón que el hype: voto en Postgres, contador en Redis (§4.2).
    const liked = !existing
    if (existing) {
      await db.vote.delete({ where: { id: existing.id } })
      await bump('post:likes', id, -1)
    } else {
      await db.vote.create({ data: { userId: me.id, target: 'post', targetId: id } })
      await bump('post:likes', id, 1)
      if (post.userId !== me.id) {
        await awardPoints(post.userId, 'like_received', 'Like recibido en tu post')
      }
    }

    const likes = post.likes + (await pending('post:likes', id))
    await invalidate('feed:*')

    return NextResponse.json({ ok: true, liked, likes })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
