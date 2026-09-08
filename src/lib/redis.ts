import Redis from 'ioredis'

// Cliente Redis con degradación elegante: si REDIS_URL no está definida, la app
// funciona igual y todo va directo a Postgres. Esto permite desplegar Redis por
// fases (ver docs/PRD-postgres-redis.md §5) sin bloquear el corte a Postgres.

const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined
  redisSub: Redis | null | undefined
}

function create(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) return null
  const client = new Redis(url, {
    // No reintentar para siempre: si Redis cae, preferimos servir desde
    // Postgres antes que acumular comandos en memoria.
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: false,
  })
  client.on('error', (err) => {
    // Un Redis caído no debe tumbar la app ni llenar el log en cada request.
    if (!globalForRedis.redis) return
    console.error('[redis]', err.message)
  })
  return client
}

export const redis: Redis | null = globalForRedis.redis ?? create()
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

export const redisEnabled = () => redis !== null

/** Ejecuta una operación de Redis; si falla o no hay Redis, devuelve `fallback`. */
export async function safeRedis<T>(
  op: (client: Redis) => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!redis) return fallback
  try {
    return await op(redis)
  } catch {
    return fallback
  }
}

/**
 * Conexión dedicada para suscripciones Pub/Sub. Redis bloquea una conexión en
 * modo subscriber, así que no puede compartirse con la de comandos normales.
 */
export function subscriber(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) return null
  if (globalForRedis.redisSub) return globalForRedis.redisSub
  const sub = new Redis(url, { maxRetriesPerRequest: 2 })
  sub.on('error', (err) => console.error('[redis:sub]', err.message))
  if (process.env.NODE_ENV !== 'production') globalForRedis.redisSub = sub
  return sub
}

/** Publica en un canal Pub/Sub. No-op si Redis no está configurado. */
export async function publish(channel: string, payload: unknown) {
  await safeRedis((c) => c.publish(channel, JSON.stringify(payload)), 0)
}
