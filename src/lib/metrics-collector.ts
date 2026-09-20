import { trackExternal, trackProcess } from '@/lib/metrics'
import { pusherServer, CHAT_CHANNEL } from '@/lib/pusher-server'

/**
 * Engancha las métricas al arranque del servidor (ver instrumentation.ts):
 *  - envuelve fetch para contar las peticiones a APIs de fuera por servicio;
 *  - toma cada minuto memoria, retraso del bucle de eventos y conectados.
 *
 * Nada de esto puede tumbar una petición: todo va con try/catch y, si falla,
 * simplemente no se apunta.
 */

const g = globalThis as unknown as { __cabalMetrics?: boolean }

/** Nombre corto del servicio a partir del host, para agrupar en el panel. */
function serviceOf(url: string): string | null {
  try {
    const host = new URL(url).hostname
    if (host === 'localhost' || host === '127.0.0.1') return null
    const parts = host.split('.')
    // api.geckoterminal.com → geckoterminal
    return parts.length >= 2 ? parts[parts.length - 2] : host
  } catch {
    return null
  }
}

export function startMetricsCollector() {
  if (g.__cabalMetrics) return
  g.__cabalMetrics = true

  const original = globalThis.fetch
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const service = serviceOf(url)
    if (!service) return original(input, init)
    const started = Date.now()
    try {
      const res = await original(input, init)
      trackExternal(service, Date.now() - started, res.ok)
      return res
    } catch (e) {
      trackExternal(service, Date.now() - started, false)
      throw e
    }
  }

  // Retraso del bucle de eventos: si sube, el servidor va justo de CPU
  let lagMs = 0
  let last = Date.now()
  setInterval(() => {
    const now = Date.now()
    lagMs = Math.max(0, now - last - 500)
    last = now
  }, 500).unref?.()

  setInterval(() => {
    void (async () => {
      try {
        const mem = process.memoryUsage()
        let online: number | null = null
        if (pusherServer) {
          const info = (await pusherServer
            .get({ path: `/channels/${CHAT_CHANNEL}`, params: { info: 'user_count' } })
            .then((r: { json: () => Promise<{ user_count?: number }> }) => r.json())
            .catch(() => null)) as { user_count?: number } | null
          online = typeof info?.user_count === 'number' ? info.user_count : null
        }
        trackProcess({
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapMb: Math.round(mem.heapUsed / 1024 / 1024),
          lagMs,
          online,
        })
      } catch {
        // Las métricas nunca deben hacer ruido
      }
    })()
  }, 60_000).unref?.()
}
