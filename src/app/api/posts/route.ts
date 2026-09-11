import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, getCurrentUser } from '@/lib/api-helpers'
import { toPostDTO } from '@/lib/serializers'
import { resolveCallTarget, snapshotCallEntry } from '@/lib/calls'
import { invalidate } from '@/lib/cache'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()

    const limit = await rateLimit(`post:${me.id ?? clientIp(req)}`, 10, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json()
    const { kind, content, launchId, tokenId } = body
    if (!content || !String(content).trim()) {
      return NextResponse.json({ error: 'El contenido está vacío' }, { status: 400 })
    }
    const postKind = ['thesis', 'comment', 'call'].includes(kind) ? kind : 'comment'

    // Call: se le exige el contrato (a mano, o el del launch/token enlazado) y
    // se le toma la foto del precio ahí mismo — es la prueba de a qué precio
    // se llamó. Sin contrato reconocible no se puede verificar nada, así que
    // no se deja publicar como call (se puede publicar como comentario).
    let callSnapshot: Awaited<ReturnType<typeof snapshotCallEntry>> = null
    let callTarget: Awaited<ReturnType<typeof resolveCallTarget>> = null
    if (postKind === 'call') {
      callTarget = await resolveCallTarget(body)
      if (!callTarget) {
        return NextResponse.json(
          { error: 'Pega el contrato (CA) del token para hacer la call, o enlázala a un launch/token con CA' },
          { status: 400 }
        )
      }
      callSnapshot = await snapshotCallEntry(callTarget.network, callTarget.contract)
      if (!callSnapshot) {
        return NextResponse.json(
          { error: 'No encontramos un mercado activo para ese contrato todavía. Prueba de nuevo en unos minutos.' },
          { status: 404 }
        )
      }
    }

    const post = await db.post.create({
      data: {
        kind: postKind,
        content: String(content).trim().slice(0, 1000),
        userId: me.id,
        launchId: launchId || null,
        tokenId: tokenId || null,
        ...(callTarget && callSnapshot
          ? {
              contract: callTarget.contract,
              network: callTarget.network,
              entryPriceUsd: callSnapshot.entryPriceUsd,
              entryMc: callSnapshot.entryMc,
              entryDexId: callSnapshot.dexId,
              entryPairUrl: callSnapshot.pairUrl,
            }
          : {}),
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
