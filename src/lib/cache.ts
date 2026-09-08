import { redis, safeRedis } from '@/lib/redis'

// Caché de lecturas sobre Redis (PRD §3, fase F6). Sin REDIS_URL, `cached`
// simplemente ejecuta la consulta: el comportamiento es idéntico, solo más lento.

const PREFIX = 'cabal:cache:'

export const CACHE_TTL = {
  leaderboard: 30,
  feed: 15,
  launch: 60,
  affiliate: 300,
} as const

/**
 * Envuelve una consulta con caché read-through.
 *
 * @param key   Clave lógica, sin prefijo (ej. `leaderboard:points:50`).
 * @param ttl   Segundos de vida. Corto a propósito: preferimos datos frescos
 *              a invalidación perfecta en feeds que cambian constantemente.
 * @param query Función que produce el valor cuando no hay acierto en caché.
 */
export async function cached<T>(
  key: string,
  ttl: number,
  query: () => Promise<T>,
): Promise<T> {
  if (!redis) return query()

  const full = PREFIX + key
  const hit = await safeRedis((c) => c.get(full), null)
  if (hit !== null) {
    try {
      return JSON.parse(hit) as T
    } catch {
      // Valor corrupto en caché: lo ignoramos y recalculamos.
    }
  }

  const value = await query()
  await safeRedis((c) => c.set(full, JSON.stringify(value), 'EX', ttl), null)
  return value
}

/** Invalida claves por patrón (ej. `feed:*`). Usa SCAN, nunca KEYS. */
export async function invalidate(pattern: string) {
  await safeRedis(async (c) => {
    let cursor = '0'
    do {
      const [next, keys] = await c.scan(cursor, 'MATCH', PREFIX + pattern, 'COUNT', 200)
      cursor = next
      if (keys.length) await c.del(...keys)
    } while (cursor !== '0')
    return null
  }, null)
}
