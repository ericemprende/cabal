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

let cachedToken: string | null = null

async function umamiLogin(): Promise<string> {
  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
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
  let res = await fetch(`${UMAMI_URL}${path}`, {
    headers: { Authorization: `Bearer ${cachedToken}` },
    cache: 'no-store',
  })
  if (res.status === 401) {
    cachedToken = await umamiLogin()
    res = await fetch(`${UMAMI_URL}${path}`, {
      headers: { Authorization: `Bearer ${cachedToken}` },
      cache: 'no-store',
    })
  }
  return res
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req)

    if (!UMAMI_URL || !UMAMI_WEBSITE_ID || !UMAMI_USERNAME || !UMAMI_PASSWORD) {
      return NextResponse.json({ configured: false })
    }

    const now = Date.now()
    const day = 86_400_000
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0)

    const [today, last7, last30, series] = await Promise.all([
      umamiFetch(
        `/api/websites/${UMAMI_WEBSITE_ID}/stats?startAt=${startToday.getTime()}&endAt=${now}`
      ).then((r) => r.json()),
      umamiFetch(
        `/api/websites/${UMAMI_WEBSITE_ID}/stats?startAt=${now - 7 * day}&endAt=${now}`
      ).then((r) => r.json()),
      umamiFetch(
        `/api/websites/${UMAMI_WEBSITE_ID}/stats?startAt=${now - 30 * day}&endAt=${now}`
      ).then((r) => r.json()),
      umamiFetch(
        `/api/websites/${UMAMI_WEBSITE_ID}/pageviews?startAt=${now - 14 * day}&endAt=${now}&unit=day&timezone=UTC`
      ).then((r) => r.json()),
    ])

    return NextResponse.json({
      configured: true,
      dashboardUrl: UMAMI_URL,
      today: { visitors: today.visitors ?? 0, pageviews: today.pageviews ?? 0, visits: today.visits ?? 0 },
      last7Days: { visitors: last7.visitors ?? 0, pageviews: last7.pageviews ?? 0, visits: last7.visits ?? 0 },
      last30Days: { visitors: last30.visitors ?? 0, pageviews: last30.pageviews ?? 0, visits: last30.visits ?? 0 },
      avgDailyVisitors30d: Math.round(((last30.visitors ?? 0) / 30) * 10) / 10,
      series: (series.sessions ?? []).map((s: { x: string; y: number }) => ({ date: s.x.slice(5, 10), visitors: s.y })),
    })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
