import { safeRedis } from '@/lib/redis'

/**
 * Métricas del propio servidor, para el panel de admin: cuántas consultas van
 * a Postgres, cuántas a las APIs de fuera (DexScreener, GeckoTerminal,
 * Telegram, Discord…), cuánto tardan, cuánta memoria gasta el proceso y
 * cuánta gente hay conectada.
 *
 * Todo se guarda por minuto y se borra solo a las 26 h: la idea es ver picos y
 * saber cuándo hace falta ampliar el servidor, no guardar un histórico largo.
 * Con Redis los datos sobreviven a los despliegues; sin Redis se guardan en
 * memoria y se pierden al reiniciar, que para mirar el día vale igual.
 *
 * Es contabilidad, no negocio: si falla, nunca debe romper una petición.
 */

export const METRICS_WINDOW_MIN = 24 * 60
const TTL_SEC = 26 * 60 * 60
const KEY = (minute: number) => `cabal:metrics:m:${minute}`

/** Campos contadores de cada minuto. Los de tiempo son sumas de milisegundos. */
export type MetricBucket = {
  minute: number
  db: number
  dbMs: number
  ext: number
  extMs: number
  extErr: number
  /** Peticiones externas por servicio: { geckoterminal: 12, dexscreener: 30 } */
  byHost: Record<string, number>
  /** Último valor visto en ese minuto (medias móviles no: interesa el pico). */
  rssMb: number | null
  heapMb: number | null
  online: number | null
  lagMs: number | null
}

const memory = new Map<number, Record<string, number>>()

function nowMinute(): number {
  return Math.floor(Date.now() / 60_000)
}

/** Suma a un contador del minuto en curso. Nunca lanza ni hace esperar. */
function add(field: string, by = 1) {
  const minute = nowMinute()
  const bucket = memory.get(minute) ?? {}
  bucket[field] = (bucket[field] ?? 0) + by
  memory.set(minute, bucket)
  if (memory.size > METRICS_WINDOW_MIN + 10) {
    for (const k of memory.keys()) {
      if (k < minute - METRICS_WINDOW_MIN) memory.delete(k)
    }
  }
  void safeRedis(async (c) => {
    await c.hincrby(KEY(minute), field, Math.round(by))
    await c.expire(KEY(minute), TTL_SEC)
    return null
  }, null)
}

/** Guarda un valor puntual del minuto (memoria, conectados…). */
function set(field: string, value: number) {
  const minute = nowMinute()
  const bucket = memory.get(minute) ?? {}
  bucket[field] = value
  memory.set(minute, bucket)
  void safeRedis(async (c) => {
    await c.hset(KEY(minute), field, String(Math.round(value)))
    await c.expire(KEY(minute), TTL_SEC)
    return null
  }, null)
}

/** Una consulta a Postgres. */
export function trackDb(ms: number) {
  add('db')
  add('dbMs', ms)
}

/** Una petición a una API de fuera, por servicio. */
export function trackExternal(host: string, ms: number, ok: boolean) {
  add('ext')
  add('extMs', ms)
  add(`h:${host}`)
  if (!ok) add('extErr')
}

export function trackProcess(sample: { rssMb: number; heapMb: number; lagMs: number; online: number | null }) {
  set('rssMb', sample.rssMb)
  set('heapMb', sample.heapMb)
  set('lagMs', sample.lagMs)
  if (sample.online !== null) set('online', sample.online)
}

function toBucket(minute: number, raw: Record<string, number>): MetricBucket {
  const byHost: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) if (k.startsWith('h:')) byHost[k.slice(2)] = v
  return {
    minute,
    db: raw.db ?? 0,
    dbMs: raw.dbMs ?? 0,
    ext: raw.ext ?? 0,
    extMs: raw.extMs ?? 0,
    extErr: raw.extErr ?? 0,
    byHost,
    rssMb: raw.rssMb ?? null,
    heapMb: raw.heapMb ?? null,
    online: raw.online ?? null,
    lagMs: raw.lagMs ?? null,
  }
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

  return wanted.map((m, i) => {
    const raw: Record<string, number> = {}
    const redisRow = fromRedis?.[i]
    if (redisRow) for (const [k, v] of Object.entries(redisRow)) raw[k] = Number(v) || 0
    // Sin Redis (o para el minuto en curso, que aún no se ha volcado entero)
    const mem = memory.get(m)
    if (mem && Object.keys(raw).length === 0) Object.assign(raw, mem)
    return toBucket(m, raw)
  })
}
