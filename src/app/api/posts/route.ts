import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, getCurrentUser } from '@/lib/api-helpers'
import { toPostDTO } from '@/lib/serializers'
import { invalidate } from '@/lib/cache'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { NETWORKS } from '@/lib/cabal'

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()

    const limit = await rateLimit(`post:${me.id ?? clientIp(req)}`, 10, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json()
    const { kind, content, launchId, tokenId, contract, network } = body
    if (!content || !String(content).trim()) {
      return NextResponse.json({ error: 'El contenido está vacío' }, { status: 400 })
    }
    const postKind = ['thesis', 'comment', 'call'].includes(kind) ? kind : 'comment'

    // Una call sin contrato no sirve: la comunidad no sabría qué token comprar
    const cleanContract =
      typeof contract === 'string' && /^[a-zA-Z0-9:_-]{2,80}$/.test(contract.trim()) ? contract.trim() : null
    const cleanNetwork = typeof network === 'string' && network in NETWORKS ? network : 'solana'
    if (postKind === 'call' && !cleanContract) {
      return NextResponse.json({ error: 'Ingresa el CA/contrato del token para publicar una call' }, { status: 400 })
    }

    const post = await db.post.create({
      data: {
        kind: postKind,
        content: String(content).trim().slice(0, 1000),
        userId: me.id,
        launchId: launchId || null,
        tokenId: tokenId || null,
        contract: postKind === 'call' ? cleanContract : null,
        network: postKind === 'call' ? cleanNetwork : null,
      },
      include: { user: true },
    })
    // Points: thesis > comment (calls count as thesis-lite; only thesis & comment earn)
    const reason = postKind === 'thesis' ? 'thesis' : 'comment'
    const pointsEarned = await awardPoints(me.id, reason as 'thesis' | 'comment', postKind === 'thesis' ? 'Tesis publicada' : 'Comentario publicado')
    await invalidate('feed:*')
    return NextResponse.json({ ok: true, pointsEarned, post: await toPostDTO(post, false) }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
