import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { guideConfig, saveGuideConfig } from '@/lib/guide-settings'

function fail(e: unknown) {
  if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
  return NextResponse.json({ error: (e as Error).message }, { status: 500 })
}

/** GET /api/admin/guide — el escuadrón entero, incluidos los que están fuera de servicio. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    return NextResponse.json(await guideConfig())
  } catch (e) {
    return fail(e)
  }
}

/** PUT — foto y estado de cada personaje, quién atiende por defecto y si el asistente aparece. */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    return NextResponse.json(await saveGuideConfig(body ?? {}))
  } catch (e) {
    return fail(e)
  }
}
