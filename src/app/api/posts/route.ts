import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, getCurrentUser } from '@/lib/api-helpers'
import { toPostDTO } from '@/lib/serializers'

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    const body = await req.json()
    const { kind, content, launchId, tokenId } = body
    if (!content || !String(content).trim()) {
      return NextResponse.json({ error: 'El contenido está vacío' }, { status: 400 })
    }
    const postKind = ['thesis', 'comment', 'call'].includes(kind) ? kind : 'comment'
    const post = await db.post.create({
      data: {
        kind: postKind,
        content: String(content).trim().slice(0, 1000),
        userId: me.id,
        launchId: launchId || null,
        tokenId: tokenId || null,
      },
      include: { user: true },
    })
    // Points: thesis > comment (calls count as thesis-lite; only thesis & comment earn)
    const reason = postKind === 'thesis' ? 'thesis' : 'comment'
    const pointsEarned = await awardPoints(me.id, reason as 'thesis' | 'comment', postKind === 'thesis' ? 'Tesis publicada' : 'Comentario publicado')
    return NextResponse.json({ ok: true, pointsEarned, post: await toPostDTO(post, false) }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
