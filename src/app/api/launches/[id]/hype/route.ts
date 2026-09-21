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

    const limit = await rateLimit(`hype:${me.id ?? clientIp(req)}`, 30, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const existing = await db.vote.findUnique({
      where: { userId_target_targetId: { userId: me.id, target: 'launch', targetId: id } },
    })

    // El Vote es la fuente de verdad de "¿ya di hype?" y sigue en Postgres.
    // El contador va por Redis (`bump`) para no serializar mil escrituras
    // sobre la misma fila de Launch. Ver docs/PRD-postgres-redis.md §4.2.
    const hyped = !existing || existing.kind === 'fud'
    if (existing?.kind === 'fud') {
      // Cambio de bando: el fueguito retira el voto en contra y su crítica
      // queda marcada como retractada en el hilo (igual que al retractarse
      // desde el propio botón del popó).
      await db.vote.update({ where: { id: existing.id }, data: { kind: 'hype', reasonPostId: null } })
      await bump('launch:fud', id, -1)
      await bump('launch:hype', id, 1)
      if (existing.reasonPostId) {
        await db.post.updateMany({ where: { id: existing.reasonPostId }, data: { retracted: true } })
      }
    } else if (existing) {
      await db.vote.delete({ where: { id: existing.id } })
      await bump('launch:hype', id, -1)
    } else {
      await db.vote.create({ data: { userId: me.id, target: 'launch', targetId: id, kind: 'hype' } })
      await bump('launch:hype', id, 1)
    }

    const launch = await db.launch.findUnique({ where: { id } })
    // Valor persistido + delta aún sin volcar, para que el usuario vea su
    // propia acción reflejada de inmediato.
    const hype = (launch?.hype ?? 0) + (await pending('launch:hype', id))

    if (hyped && launch && launch.createdById !== me.id) {
      await awardPoints(launch.createdById, 'hype_received', `Hype recibido en ${launch.ticker}`)
    }
    await invalidate('launches:*')

    return NextResponse.json({ ok: true, hyped, hype })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
