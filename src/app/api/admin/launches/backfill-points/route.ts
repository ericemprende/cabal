import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, ForbiddenError, getPointRules, requireAdmin } from '@/lib/api-helpers'

// POST /api/admin/launches/backfill-points — da los puntos de "launch
// publicado" a quien publicó launches que no los recibieron (la regla
// points_launch no existía en la BD y valía 0). Compara, por usuario, cuántos
// launches publicó con cuántos PointEvent 'launch' tiene y otorga la
// diferencia; ejecutarlo dos veces no duplica nada.
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const amount = (await getPointRules()).points_launch ?? 0
    if (amount <= 0) return NextResponse.json({ error: 'La regla "Launch publicado" está en 0' }, { status: 400 })

    const [launches, events] = await Promise.all([
      db.launch.findMany({ select: { createdById: true, name: true }, orderBy: { createdAt: 'asc' } }),
      db.pointEvent.groupBy({ by: ['userId'], where: { reason: 'launch' }, _count: { _all: true } }),
    ])
    const awarded = new Map(events.map((e) => [e.userId, e._count._all]))
    const byUser = new Map<string, string[]>()
    for (const l of launches) byUser.set(l.createdById, [...(byUser.get(l.createdById) ?? []), l.name])

    let users = 0
    let launchesFixed = 0
    let points = 0
    for (const [userId, names] of byUser) {
      const missing = names.length - (awarded.get(userId) ?? 0)
      if (missing <= 0) continue
      // Los últimos publicados son los que se quedaron sin puntos.
      for (const name of names.slice(-missing)) {
        points += await awardPoints(userId, 'launch', `Publicaste el launch: ${name} (puntos pendientes)`, amount)
        launchesFixed++
      }
      users++
    }

    return NextResponse.json({ ok: true, users, launches: launchesFixed, points })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
