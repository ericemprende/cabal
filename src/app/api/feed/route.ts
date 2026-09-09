import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/api-helpers'
import { toPostDTO } from '@/lib/serializers'
import { cached, CACHE_TTL } from '@/lib/cache'
import { pendingMany } from '@/lib/counters'
import type { PostDTO } from '@/lib/types'

export async function GET() {
  try {
    const me = await getCurrentUser()

    // La lista de posts es la misma para todos, así que se cachea una vez.
    // Los votos son por usuario y NO se cachean: mezclarlos filtraría los
    // likes de un usuario a otro.
    const [posts, votes] = await Promise.all([
      cached('feed:latest:60', CACHE_TTL.feed, () =>
        db.post.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 60 }),
      ),
      db.vote.findMany({ where: { userId: me.id, target: 'post' } }),
    ])

    const likedIds = new Set(votes.map((v) => v.targetId))
    // Deltas aún no volcados a Postgres, en una sola llamada a Redis en vez
    // de una por post.
    const deltas = await pendingMany('post:likes', posts.map((p) => p.id))

    const dtos: PostDTO[] = []
    for (const p of posts) {
      // `cached` devuelve JSON: las fechas vuelven como string y toPostDTO
      // espera Date.
      const row = { ...p, createdAt: new Date(p.createdAt) }
      const dto = await toPostDTO(row, likedIds.has(p.id))
      dtos.push({ ...dto, likes: dto.likes + (deltas[p.id] ?? 0) })
    }
    return NextResponse.json(dtos)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
