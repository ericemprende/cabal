import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'

// Umami vive en un contenedor aparte en el mismo Dokploy (ver memoria
// "analytics-umami-cabal"). No tiene API key persistente en esta versión,
// así que iniciamos sesión con usuario/contraseña de admin en cada request
// y cacheamos el token en memoria del proceso hasta que expire o falle.
const UMAMI_URL = process.env.UMAMI_URL // p.ej. https://analytics.cabal.army
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID
const UMAMI_USERNAME = process.env.UMAMI_USERNAME
const UMAMI_PASSWORD = process.env.UMAMI_PASSWORD

// Las llamadas del servidor van por la red interna de Docker, sin TLS.
// Por el dominio público solo se puede si Traefik tiene emitido el
// certificado de Let's Encrypt; cuando no lo tiene, Node rechaza la conexión
// ("unable to verify the first certificate") y el panel se queda sin datos.
// UMAMI_URL se sigue usando solo para el enlace al panel de Umami.
const UMAMI_API_URL = process.env.UMAMI_API_URL || 'http://cabal-umami-app-q9yv3w:3000'

let cachedToken: string | null = null

async function umamiLogin(): Promise<string> {
  const res = await fetch(`${UMAMI_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: UMAMI_USERNAME, password: UMAMI_PASSWORD }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('No se pudo autenticar con Umami')
  const data = await res.json()
  return data.token as string
}

async function umamiFetch(path: string): Promise<Response> {
  if (!cachedToken) cachedToken = await umamiLogin()
  let res = await fetch(`${UMAMI_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${cachedToken}` },
    cache: 'no-store',
  })
  if (res.status === 401) {
    cachedToken = await umamiLogin()
    res = await fetch(`${UMAMI_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${cachedToken}` },
      cache: 'no-store',
    })
  }
  return res
}

/** Diferencia (zona - UTC) en ms para ese instante. Contempla horario de verano. */
function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour') % 24, n('minute'), n('second'))
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** Instante real en que empezó el día de hoy en esa zona horaria. */
function startOfTodayIn(tz: string): number {
  const now = new Date()
  const offset = tzOffsetMs(tz, now)
  const wall = new Date(now.getTime() + offset)
  wall.setUTCHours(0, 0, 0, 0)
  return wall.getTime() - offset
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req)

    if (!UMAMI_URL || !UMAMI_WEBSITE_ID || !UMAMI_USERNAME || !UMAMI_PASSWORD) {
      return NextResponse.json({ configured: false })
    }

    // El panel manda su zona horaria: si los días se cortaran a medianoche UTC
    // (19:00 en Colombia), el tráfico de la noche caería en el día siguiente.
    // Igual que el resto de la app, que muestra las horas en la zona del navegador.
    const asked = new URL(req.url).searchParams.get('tz')
    let tz = 'UTC'
    try {
      if (asked) {
        new Intl.DateTimeFormat('en-US', { timeZone: asked })
        tz = asked
      }
    } catch {
      tz = 'UTC'
    }

    const now = Date.now()
    const day = 86_400_000
    const startToday = startOfTodayIn(tz)

    const [today, last7, last30, series] = await Promise.all([
      umamiFetch(
        `/api/websites/${UMAMI_WEBSITE_ID}/stats?startAt=${startToday}&endAt=${now}`
      ).then((r) => r.json()),
      umamiFetch(
        `/api/websites/${UMAMI_WEBSITE_ID}/stats?startAt=${now - 7 * day}&endAt=${now}`
      ).then((r) => r.json()),
      umamiFetch(
        `/api/websites/${UMAMI_WEBSITE_ID}/stats?startAt=${now - 30 * day}&endAt=${now}`
      ).then((r) => r.json()),
      umamiFetch(
        `/api/websites/${UMAMI_WEBSITE_ID}/pageviews?startAt=${now - 14 * day}&endAt=${now}&unit=day&timezone=${encodeURIComponent(tz)}`
      ).then((r) => r.json()),
    ])

    return NextResponse.json({
      configured: true,
      dashboardUrl: UMAMI_URL,
      timezone: tz,
      today: { visitors: today.visitors ?? 0, pageviews: today.pageviews ?? 0, visits: today.visits ?? 0 },
      last7Days: { visitors: last7.visitors ?? 0, pageviews: last7.pageviews ?? 0, visits: last7.visits ?? 0 },
      last30Days: { visitors: last30.visitors ?? 0, pageviews: last30.pageviews ?? 0, visits: last30.visits ?? 0 },
      avgDailyVisitors30d: Math.round(((last30.visitors ?? 0) / 30) * 10) / 10,
      // La serie "sessions" de Umami son visitantes únicos por día (comprobado
      // contra /stats: el 19/09 dio sessions=4 y stats.visitors=4, visits=13).
      series: (series.sessions ?? []).map((s: { x: string; y: number }) => ({ date: s.x.slice(5, 10), visitors: s.y })),
    })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
