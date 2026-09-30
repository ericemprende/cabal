import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSessionUser, errorStatus } from '@/lib/api-helpers'
import { bump, pending } from '@/lib/counters'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { invalidate } from '@/lib/cache'
import { FUD_REASON_MAX, FUD_REASON_MIN } from '@/lib/fud'

async function fudCount(id: string, fallback: number) {
  return fallback + (await pending('launch:fud', id))
}

/**
 * Votar en contra de un proyecto ("popó"). A diferencia del hype, aquí hay
 * peaje: hay que escribir por qué, y ese porqué se publica como comentario
 * firmado en el hilo del proyecto (kind = "fud"), donde el dev y el resto
 * pueden responder. Quien no quiera argumentar, no vota.
 *
 * hype y fud son el mismo Vote con distinto `kind`, así que son excluyentes:
 * votar en contra retira el hype que hubiera.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await requireSessionUser()

    // Más estricto que el hype (30/min): cada fud escribe un comentario.
    const limit = await rateLimit(`fud:${me.id ?? clientIp(req)}`, 6, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < FUD_REASON_MIN) {
      return NextResponse.json(
        { error: `Explica en al menos ${FUD_REASON_MIN} caracteres por qué crees que es un mal proyecto` },
        { status: 400 },
      )
    }

    const launch = await db.launch.findUnique({ where: { id } })
    if (!launch) return NextResponse.json({ error: 'El proyecto no existe' }, { status: 404 })

    const existing = await db.vote.findUnique({
      where: { userId_target_targetId: { userId: me.id, target: 'launch', targetId: id } },
    })
    if (existing?.kind === 'fud') {
      return NextResponse.json({ error: 'Ya votaste en contra de este proyecto' }, { status: 409 })
    }

    // El motivo es un post normal del hilo: se le puede responder y dar like.
    // No da puntos, a diferencia de un comentario cualquiera: criticar no se
    // premia, para que nadie farmee puntos tirando mierda.
    const post = await db.post.create({
      data: {
        kind: 'fud',
        content: reason.slice(0, FUD_REASON_MAX),
        userId: me.id,
        launchId: id,
      },
    })

    if (existing) {
      await db.vote.update({ where: { id: existing.id }, data: { kind: 'fud', reasonPostId: post.id } })
      await bump('launch:hype', id, -1)
    } else {
      await db.vote.create({
        data: { userId: me.id, target: 'launch', targetId: id, kind: 'fud', reasonPostId: post.id },
      })
    }
    await bump('launch:fud', id, 1)

    await invalidate('launches:*')
    await invalidate('feed:*')

    return NextResponse.json({ ok: true, fudded: true, fud: await fudCount(id, launch.fud), postId: post.id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: errorStatus(e) })
  }
}

/**
 * Retractarse. El voto en contra desaparece, pero el comentario se queda en el
 * hilo marcado como retractado: si media comunidad le respondió, borrarlo
 * dejaría esas respuestas hablando solas.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await requireSessionUser()

    const existing = await db.vote.findUnique({
      where: { userId_target_targetId: { userId: me.id, target: 'launch', targetId: id } },
    })
    const launch = await db.launch.findUnique({ where: { id } })
    if (!launch) return NextResponse.json({ error: 'El proyecto no existe' }, { status: 404 })
    if (!existing || existing.kind !== 'fud') {
      return NextResponse.json({ ok: true, fudded: false, fud: await fudCount(id, launch.fud) })
    }

    await db.vote.delete({ where: { id: existing.id } })
    await bump('launch:fud', id, -1)
    if (existing.reasonPostId) {
      await db.post.updateMany({ where: { id: existing.reasonPostId }, data: { retracted: true } })
    }

    await invalidate('launches:*')
    await invalidate('feed:*')

    return NextResponse.json({ ok: true, fudded: false, fud: await fudCount(id, launch.fud) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: errorStatus(e) })
  }
}
