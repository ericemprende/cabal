import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { getViewer } from '@/lib/premium'
import { activeBoostScores, ammoBalance, fireAmmo, isBoostTarget } from '@/lib/ammo'
import { invalidate } from '@/lib/cache'

/** GET /api/boosts — munición viva de cada proyecto, para ordenar el Radar. */
export async function GET() {
  try {
    return NextResponse.json(await activeBoostScores())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/boosts — { targetType, targetId, bullets }
 * Dispara munición sobre un launch o un token. Cualquiera puede disparar a
 * cualquier proyecto: la comunidad también empuja lo que le gusta.
 */
export async function POST(req: Request) {
  try {
    const viewer = await getViewer(req)
    if (!viewer.userId) {
      return NextResponse.json({ error: 'Inicia sesión para disparar munición' }, { status: 401 })
    }
    const limit = await rateLimit(`boost:${viewer.userId}`, 20, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const { targetType, targetId } = body
    if (!isBoostTarget(targetType) || typeof targetId !== 'string' || !targetId) {
      return NextResponse.json({ error: 'Proyecto no válido' }, { status: 400 })
    }

    // Que el proyecto exista y se pueda ver: nadie gasta balas en un launch
    // oculto o en un id inventado.
    const exists =
      targetType === 'launch'
        ? await db.launch.findFirst({ where: { id: targetId, hidden: false }, select: { id: true } })
        : await db.token.findUnique({ where: { id: targetId }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: 'Ese proyecto ya no está disponible' }, { status: 404 })

    const result = await fireAmmo({
      userId: viewer.userId,
      targetType,
      targetId,
      bullets: Number(body.bullets),
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    // El Radar y la lista de tokens viajan cacheados: sin esto el proyecto
    // tardaría hasta un minuto en subir después de pagar por subir.
    await Promise.all([invalidate('launches:*'), invalidate('tokens:*')])

    return NextResponse.json({
      boost: result.boost,
      balance: await ammoBalance(viewer.userId),
      scores: await activeBoostScores(),
    })
  } catch (e) {
    console.error('[boosts] POST', e)
    return NextResponse.json({ error: 'No se pudo disparar la munición' }, { status: 500 })
  }
}
