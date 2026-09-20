import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { METRICS_WINDOW_MIN } from '@/lib/metrics'
import { readMetrics } from '@/lib/metrics-store'
import type { AdminMetricsDTO } from '@/lib/types'

/**
 * GET /api/admin/metrics?minutes=360 — salud del servidor para el panel:
 * consultas a Postgres, peticiones a APIs de fuera, memoria y conectados.
 *
 * Los minutos se agrupan en tramos para que la gráfica no lleve 1440 puntos.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const params = new URL(req.url).searchParams
    const minutes = Math.min(Math.max(Number(params.get('minutes')) || 360, 15), METRICS_WINDOW_MIN)
    const buckets = await readMetrics(minutes)
    // ~60 puntos en la gráfica, sea cual sea la ventana
    const step = Math.max(1, Math.round(minutes / 60))

    const points: AdminMetricsDTO['points'] = []
    for (let i = 0; i < buckets.length; i += step) {
      const slice = buckets.slice(i, i + step)
      const sum = (f: (b: (typeof slice)[number]) => number) => slice.reduce((acc, b) => acc + f(b), 0)
      const lastOf = (f: (b: (typeof slice)[number]) => number | null) => {
        for (let j = slice.length - 1; j >= 0; j--) {
          const v = f(slice[j])
          if (v !== null) return v
        }
        return null
      }
      const db = sum((b) => b.db)
      const ext = sum((b) => b.ext)
      points.push({
        at: new Date(slice[0].minute * 60_000).toISOString(),
        dbPerMin: Math.round(db / slice.length),
        dbAvgMs: db ? Math.round(sum((b) => b.dbMs) / db) : 0,
        extPerMin: Math.round(ext / slice.length),
        extAvgMs: ext ? Math.round(sum((b) => b.extMs) / ext) : 0,
        extErr: sum((b) => b.extErr),
        rssMb: lastOf((b) => b.rssMb),
        online: lastOf((b) => b.online),
        lagMs: lastOf((b) => b.lagMs),
      })
    }

    // Reparto por servicio de fuera en toda la ventana
    const byService = new Map<string, number>()
    for (const b of buckets) {
      for (const [host, n] of Object.entries(b.byHost)) byService.set(host, (byService.get(host) ?? 0) + n)
    }

    const last = buckets[buckets.length - 1]
    const hour = buckets.slice(-60)
    const dto: AdminMetricsDTO = {
      minutes,
      points,
      services: [...byService.entries()].map(([name, calls]) => ({ name, calls })).sort((a, b) => b.calls - a.calls),
      now: {
        rssMb: last?.rssMb ?? null,
        heapMb: last?.heapMb ?? null,
        online: last?.online ?? null,
        lagMs: last?.lagMs ?? null,
        dbPerMin: Math.round(hour.reduce((a, b) => a + b.db, 0) / Math.max(1, hour.length)),
        extPerMin: Math.round(hour.reduce((a, b) => a + b.ext, 0) / Math.max(1, hour.length)),
        extErrLastHour: hour.reduce((a, b) => a + b.extErr, 0),
      },
    }
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: 'Solo admin' }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
