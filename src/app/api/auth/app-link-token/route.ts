import { NextResponse } from 'next/server'
import { errorStatus, requireSessionUser } from '@/lib/api-helpers'
import { createHandoffToken } from '@/lib/app-handoff'

/**
 * POST /api/auth/app-link-token → { token }
 *
 * La app de iOS lo pide antes de vincular X, Google o Discord desde el perfil:
 * el flujo se abre en el navegador del sistema, que no tiene la sesión, y este
 * token (10 minutos, un solo uso) le dice al callback a qué cuenta vincular.
 */
export async function POST() {
  try {
    const me = await requireSessionUser()
    return NextResponse.json({ token: createHandoffToken(me.id, 'link') })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: errorStatus(e) })
  }
}
