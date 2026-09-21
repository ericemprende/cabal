import { db } from '@/lib/db'
import { redis, safeRedis } from '@/lib/redis'

// Contadores calientes (PRD §4.2). `Launch.hype` y `Post.likes` se actualizaban
// con un UPDATE por evento sobre la MISMA fila: mil usuarios dando hype al mismo
// launch serializan esas escrituras incluso en Postgres, porque cada transacción
// espera el lock de fila de la anterior.
//
// Aquí el incremento va a Redis (INCR, sin locks) y se vuelca a Postgres por
// lotes con `flushCounters`. La lectura suma el valor persistido más el delta
// pendiente, así el usuario ve su acción reflejada de inmediato.

type Counter = 'launch:hype' | 'launch:fud' | 'post:likes'

const DELTA = 'cabal:ctr:'          // hash por contador: id -> delta pendiente
const DIRTY = 'cabal:ctr:dirty'     // set de contadores con deltas por volcar

/** Incrementa un contador. Sin Redis, cae al UPDATE directo de siempre. */
export async function bump(counter: Counter, id: string, by = 1): Promise<void> {
  if (!redis) {
    await writeDirect(counter, id, by)
    return
  }
  const done = await safeRedis(async (c) => {
    await c.multi().hincrby(DELTA + counter, id, by).sadd(DIRTY, counter).exec()
    return true
  }, false)
  if (!done) await writeDirect(counter, id, by)
}

/** Delta pendiente de volcado para un id. 0 si no hay Redis. */
export async function pending(counter: Counter, id: string): Promise<number> {
  const v = await safeRedis((c) => c.hget(DELTA + counter, id), null)
  return v ? Number(v) : 0
}

/** Deltas pendientes de varios ids a la vez, para no hacer N llamadas en un feed. */
export async function pendingMany(
  counter: Counter,
  ids: string[],
): Promise<Record<string, number>> {
  if (!ids.length) return {}
  const values = await safeRedis((c) => c.hmget(DELTA + counter, ...ids), null)
  if (!values) return {}
  const out: Record<string, number> = {}
  ids.forEach((id, i) => {
    const v = values[i]
    if (v) out[id] = Number(v)
  })
  return out
}

/**
 * Vuelca los deltas acumulados a Postgres y los descuenta de Redis.
 * Pensado para ejecutarse periódicamente (`bun run counters:flush`, cada 10-30 s).
 *
 * Toma el delta con HGETALL y lo resta con HINCRBY en vez de borrar el hash:
 * así los incrementos que lleguen durante el volcado no se pierden.
 */
export async function flushCounters(): Promise<number> {
  if (!redis) return 0
  const counters = (await safeRedis((c) => c.smembers(DIRTY), [])) as Counter[]
  let written = 0

  for (const counter of counters) {
    const deltas = await safeRedis((c) => c.hgetall(DELTA + counter), {})
    for (const [id, raw] of Object.entries(deltas)) {
      const delta = Number(raw)
      if (!delta) continue
      try {
        await writeDirect(counter, id, delta)
        await safeRedis((c) => c.hincrby(DELTA + counter, id, -delta), 0)
        written++
      } catch (err) {
        // La fila puede haber sido borrada; descartamos su delta para no
        // reintentar en bucle en cada volcado.
        console.error(`[counters] ${counter}/${id}:`, (err as Error).message)
        await safeRedis((c) => c.hdel(DELTA + counter, id), 0)
      }
    }
  }
  return written
}

async function writeDirect(counter: Counter, id: string, by: number) {
  if (counter === 'launch:hype') {
    await db.launch.update({ where: { id }, data: { hype: { increment: by } } })
  } else if (counter === 'launch:fud') {
    await db.launch.update({ where: { id }, data: { fud: { increment: by } } })
  } else {
    await db.post.update({ where: { id }, data: { likes: { increment: by } } })
  }
}
