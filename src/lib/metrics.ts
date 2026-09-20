/**
 * Contadores del servidor (consultas a Postgres, peticiones a APIs de fuera,
 * memoria, conectados) agrupados por minuto. Alimentan "Salud del servidor" en
 * el panel de admin.
 *
 * Este módulo NO importa nada: lo usa lib/db, que a su vez acaba en el paquete
 * del navegador por alguna cadena de imports, y meter aquí Redis rompía el
 * build ("Module not found: dns/net/tls"). El volcado a Redis y la lectura
 * viven en lib/metrics-store, que solo se usa desde el servidor.
 *
 * Es contabilidad, no negocio: si falla, nunca debe romper una petición.
 */

export const METRICS_WINDOW_MIN = 24 * 60

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
  /** Último valor visto en ese minuto (medias no: interesa el pico). */
  rssMb: number | null
  heapMb: number | null
  online: number | null
  lagMs: number | null
}

/** Minutos vivos en memoria. Se vuelcan a Redis y se limpian solos. */
const buckets = new Map<number, Record<string, number>>()

export function nowMinute(): number {
  return Math.floor(Date.now() / 60_000)
}

function bucketOf(minute: number): Record<string, number> {
  let b = buckets.get(minute)
  if (!b) {
    b = {}
    buckets.set(minute, b)
    if (buckets.size > 90) {
      for (const k of buckets.keys()) if (k < minute - 60) buckets.delete(k)
    }
  }
  return b
}

function add(field: string, by = 1) {
  const b = bucketOf(nowMinute())
  b[field] = (b[field] ?? 0) + by
}

function set(field: string, value: number) {
  bucketOf(nowMinute())[field] = value
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

/** Lo contado en memoria, para volcarlo o leerlo (ver lib/metrics-store). */
export function snapshot(): { minute: number; fields: Record<string, number> }[] {
  return [...buckets.entries()].map(([minute, fields]) => ({ minute, fields: { ...fields } }))
}

/** Olvida los minutos ya cerrados y volcados. */
export function forgetBefore(minute: number) {
  for (const k of buckets.keys()) if (k < minute) buckets.delete(k)
}

export function toBucket(minute: number, raw: Record<string, number>): MetricBucket {
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
