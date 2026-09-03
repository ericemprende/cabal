import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/api-helpers'
import { toPostDTO } from '@/lib/serializers'
import type { PostDTO } from '@/lib/types'

export async function GET() {
  try {
    const me = await getCurrentUser()
    const [posts, votes] = await Promise.all([
      db.post.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 60 }),
      db.vote.findMany({ where: { userId: me.id } }),
    ])
    const likedIds = new Set(votes.filter((v) => v.target === 'post').map((v) => v.targetId))
    const dtos: PostDTO[] = []
    for (const p of posts) {
      dtos.push(await toPostDTO(p, likedIds.has(p.id)))
    }
    return NextResponse.json(dtos)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
