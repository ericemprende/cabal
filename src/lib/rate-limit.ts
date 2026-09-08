import { redis } from '@/lib/redis'

// Rate limiting por ventana fija sobre Redis (PRD §3, fase F6).
// Sin REDIS_URL no se limita nada: en desarrollo es lo deseable, pero en
// producción hay que definir REDIS_URL para que esto tenga efecto.

export type RateLimitResult = {
  ok: boolean
  remaining: number
  resetIn: number
}

/**
 * @param key    Identificador del emisor (IP, userId…).
 * @param limit  Peticiones permitidas por ventana.
 * @param window Duración de la ventana en segundos.
 */
export async function rateLimit(
  key: string,
  limit: number,
  window: number,
): Promise<RateLimitResult> {
  if (!redis) return { ok: true, remaining: limit, resetIn: 0 }

  const bucket = Math.floor(Date.now() / 1000 / window)
  const full = `cabal:rl:${key}:${bucket}`

  try {
    // INCR + EXPIRE en un pipeline: una sola ida y vuelta.
    const [[, count]] = (await redis
      .multi()
      .incr(full)
      .expire(full, window)
      .exec()) as [[Error | null, number], unknown]

    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      resetIn: (bucket + 1) * window - Math.floor(Date.now() / 1000),
    }
  } catch {
    // Redis caído: dejamos pasar antes que bloquear la app.
    return { ok: true, remaining: limit, resetIn: 0 }
  }
}

/** Extrae la IP del cliente respetando la cabecera que inyecta Caddy. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/** Respuesta 429 estándar para las rutas que superan el límite. */
export function tooManyRequests(r: RateLimitResult) {
  return Response.json(
    { error: 'Demasiadas peticiones, prueba en unos segundos.' },
    { status: 429, headers: { 'Retry-After': String(r.resetIn) } },
  )
}
