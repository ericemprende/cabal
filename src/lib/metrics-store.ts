import { safeRedis } from '@/lib/redis'
import { METRICS_WINDOW_MIN, forgetBefore, nowMinute, snapshot, toBucket, type MetricBucket } from '@/lib/metrics'

/**
 * Guardado y lectura de las métricas (ver lib/metrics para los contadores).
 *
 * Con Redis los minutos sobreviven a los despliegues y se borran solos a las
 * 26 h; sin Redis se ve solo lo que lleva en memoria el proceso, que para
 * mirar el día vale igual. Solo se usa desde el servidor: importa ioredis.
 */

const TTL_SEC = 26 * 60 * 60
const KEY = (minute: number) => `cabal:metrics:m:${minute}`

/** Vuelca a Redis lo contado en memoria y olvida los minutos ya cerrados. */
export async function flushMetrics(): Promise<void> {
  const current = nowMinute()
  const rows = snapshot()
  if (rows.length === 0) return
  await safeRedis(async (c) => {
    const pipe = c.pipeline()
    for (const { minute, fields } of rows) {
      // Los contadores se escriben enteros (HSET, no HINCRBY): mientras el
      // minuto sigue vivo en memoria, su valor en Redis se reemplaza.
      const flat: string[] = []
      for (const [k, v] of Object.entries(fields)) flat.push(k, String(Math.round(v)))
      if (flat.length === 0) continue
      pipe.hset(KEY(minute), ...flat)
      pipe.expire(KEY(minute), TTL_SEC)
    }
    await pipe.exec()
    return null
  }, null)
  // El minuto en curso sigue contando; los anteriores ya están en Redis
  forgetBefore(current)
}

/** Los últimos `minutes` minutos, del más viejo al más nuevo. */
export async function readMetrics(minutes = METRICS_WINDOW_MIN): Promise<MetricBucket[]> {
  const end = nowMinute()
  const start = end - minutes + 1
  const wanted: number[] = []
  for (let m = start; m <= end; m++) wanted.push(m)

  const fromRedis = await safeRedis(async (c) => {
    const pipe = c.pipeline()
    for (const m of wanted) pipe.hgetall(KEY(m))
    const res = await pipe.exec()
    return (res ?? []).map(([, v]) => (v ?? {}) as Record<string, string>)
  }, null)

  // Lo que aún no se ha volcado (el minuto en curso, o todo si no hay Redis)
  const memory = new Map(snapshot().map((r) => [r.minute, r.fields]))

  return wanted.map((m, i) => {
    const raw: Record<string, number> = {}
    const redisRow = fromRedis?.[i]
    if (redisRow) for (const [k, v] of Object.entries(redisRow)) raw[k] = Number(v) || 0
    const mem = memory.get(m)
    if (mem) for (const [k, v] of Object.entries(mem)) raw[k] = v
    return toBucket(m, raw)
  })
}
