import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { REP_BODY_MAX, repWeight } from '@/lib/reputation'
import { recomputeReputation, repEligibility } from '@/lib/reputation-server'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { invalidate } from '@/lib/cache'
import type { ReputationDTO, ReputationReviewDTO } from '@/lib/types'

/** Cuántas reseñas con texto se mandan de golpe. */
const PAGE = 20

/** El @handle tal y como lo valida el resto de rutas públicas de usuario. */
async function findTarget(params: Promise<{ handle: string }>) {
  const { handle: raw } = await params
  const handle = decodeURIComponent(raw).replace(/^@+/, '').trim()
  if (!/^\w{1,30}$/.test(handle)) return null
  return db.user.findFirst({ where: { handle: { equals: handle, mode: 'insensitive' } } })
}

/** Quien mira, solo si tiene sesión real (el invitado demo no vota). */
async function viewer() {
  const id = await sessionUserIdFromCookies().catch(() => null)
  if (!id) return null
  return db.user.findUnique({ where: { id } })
}

const reviewDTO = (r: {
  id: string
  value: number
  body: string
  createdAt: Date
  updatedAt: Date
  author: { id: string; handle: string; name: string; avatar: string; walletVerified: boolean; xVerified: boolean }
}): ReputationReviewDTO => ({
  id: r.id,
  value: r.value === 1 ? 1 : -1,
  body: r.body,
  createdAt: r.createdAt.toISOString(),
  // Un segundo de margen: Prisma pone createdAt y updatedAt en la misma
  // escritura y no siempre coinciden al milisegundo.
  edited: r.updatedAt.getTime() - r.createdAt.getTime() > 1000,
  author: r.author,
})

/**
 * GET /api/users/<handle>/reputation — resumen, reseñas escritas y el estado
 * de quien mira (si ya votó y si puede votar).
 *
 * Abierta a cualquiera, con o sin cuenta: la reputación de un dev tiene que
 * verla también quien llega de fuera a mirar un launch.
 */
export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const target = await findTarget(params)
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const take = Math.min(Number(new URL(req.url).searchParams.get('take')) || PAGE, 100)
    const me = await viewer()

    const [reviews, withBody, mine] = await Promise.all([
      db.reputation.findMany({
        where: { targetId: target.id, hidden: false, body: { not: '' } },
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          author: {
            select: { id: true, handle: true, name: true, avatar: true, walletVerified: true, xVerified: true },
          },
        },
      }),
      db.reputation.count({ where: { targetId: target.id, hidden: false, body: { not: '' } } }),
      me
        ? db.reputation.findUnique({ where: { authorId_targetId: { authorId: me.id, targetId: target.id } } })
        : Promise.resolve(null),
    ])

    const reason = repEligibility(me, target.id)
    const dto: ReputationDTO = {
      summary: { score: target.repScore, up: target.repUp, down: target.repDown, votes: target.repUp + target.repDown },
      reviews: reviews.map(reviewDTO),
      more: Math.max(0, withBody - reviews.length),
      mine: mine && !mine.hidden ? { value: mine.value === 1 ? 1 : -1, body: mine.body } : null,
      canVote: reason === 'ok',
      reason,
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/users/<handle>/reputation — votar, cambiar el voto o retirarlo.
 *
 * body: { value: 1 | -1 | 0, body?: string }. value 0 borra la valoración;
 * repetir el mismo valor solo actualiza la reseña escrita.
 */
export async function POST(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const target = await findTarget(params)
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const me = await viewer()
    const reason = repEligibility(me, target.id)
    if (reason === 'anon') return NextResponse.json({ error: 'Entra para valorar' }, { status: 401 })
    if (reason === 'self') return NextResponse.json({ error: 'No puedes valorarte a ti mismo' }, { status: 400 })
    if (reason === 'unverified') {
      return NextResponse.json(
        { error: 'Verifica tu correo, tu X o tu wallet para poder valorar' },
        { status: 403 }
      )
    }
    const author = me! // repEligibility ya descartó el caso sin sesión

    // Tope generoso para el uso normal (votar y corregir la reseña), pero que
    // corta en seco a quien intente recorrer perfiles votando en bucle.
    const limit = await rateLimit(`rep:${author.id}`, 20, 3600)
    if (!limit.ok) return tooManyRequests(limit)

    const payload = (await req.json().catch(() => ({}))) as { value?: unknown; body?: unknown }
    const value = Number(payload.value)
    if (![1, -1, 0].includes(value)) {
      return NextResponse.json({ error: 'Valor de voto no válido' }, { status: 400 })
    }
    const body = typeof payload.body === 'string' ? payload.body.trim().slice(0, REP_BODY_MAX) : ''

    if (value === 0) {
      await db.reputation.deleteMany({ where: { authorId: author.id, targetId: target.id } })
    } else {
      const weight = repWeight(author)
      await db.reputation.upsert({
        where: { authorId_targetId: { authorId: author.id, targetId: target.id } },
        // Cambiar el voto vuelve a pesarlo con la cuenta de hoy, y deja de
        // estar oculto si lo estaba: es una valoración nueva de hecho.
        update: { value, body, weight, hidden: false },
        create: { authorId: author.id, targetId: target.id, value, body, weight },
      })
    }

    const summary = await recomputeReputation(target.id)
    // El resumen viaja dentro de cada usuario público: cualquier lista con
    // este dev (launches, feed, leaderboard) está ahora desactualizada.
    await invalidate('launches:*')

    return NextResponse.json({
      ok: true,
      summary,
      mine: value === 0 ? null : { value, body },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
