import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { ghlConfig, syncPendingToGhl } from '@/lib/ghl'

/**
 * POST /api/admin/integrations/ghl-sync — manda a GHL las cuentas con correo
 * que aún no están (las anteriores a la integración y las que fallaron).
 * Va por tandas de 100 para no pasarse del límite de GHL ni del tiempo de la
 * petición: si quedan más, se vuelve a pulsar.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    if (!ghlConfig()) return NextResponse.json({ error: 'GHL no está configurado' }, { status: 400 })
    const result = await syncPendingToGhl(100)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
