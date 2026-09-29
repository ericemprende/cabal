import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { botMetrics } from '@/lib/bot-log'

/**
 * GET /api/admin/bot-metrics?hours=24[&ref=ERR-XXXXXX]
 * Uso, tiempos y errores de los comandos de los bots. Con ref, la lista de
 * errores trae solo ese código (el que el bot le enseñó al usuario).
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const url = new URL(req.url)
    const hours = Math.min(Math.max(Number(url.searchParams.get('hours')) || 24, 1), 24 * 30)
    return NextResponse.json(await botMetrics(hours, url.searchParams.get('ref')))
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
