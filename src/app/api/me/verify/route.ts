import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import { linkProvider, SocialError, SocialProvider, unlinkProvider } from '@/lib/social'

/**
 * POST /api/me/verify
 * Modo demo de verificación social (sin API keys) + desconexión de proveedores.
 * Con credenciales configuradas, la verificación real pasa por el flujo OAuth
 * (/api/auth/x/start y /api/auth/google/start).
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser()
    const body = await req.json()
    const provider = body.provider === 'x' || body.provider === 'google' ? (body.provider as SocialProvider) : null
    if (!provider) return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })

    if (body.disconnect) {
      await unlinkProvider(me.id, provider)
      return NextResponse.json({ ok: true })
    }

    const value = typeof body.value === 'string' ? body.value.trim() : ''
    if (!value) return NextResponse.json({ error: 'Falta el valor a verificar' }, { status: 400 })

    const { pointsEarned } = await linkProvider(me.id, provider, value)
    return NextResponse.json({ ok: true, pointsEarned })
  } catch (e) {
    if (e instanceof SocialError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
