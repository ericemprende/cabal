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
    // La conexión se establece de forma asíncrona: la cola offline debe quedar
    // activa o los comandos emitidos durante el arranque se rechazan y el
    // primer request tras el boot nunca vería la caché.
    enableOfflineQueue: true,
    connectTimeout: 2000,
    // Cota superior de latencia: si Redis no responde en 1 s, el comando falla
    // y `safeRedis` sirve desde Postgres. Sin esto, un Redis colgado bloquea
    // el request en vez de degradar.
    commandTimeout: 1000,
    maxRetriesPerRequest: 1,
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
