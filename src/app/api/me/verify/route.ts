import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser, errorStatus } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import { linkProvider, SocialError, SocialProvider, unlinkProvider } from '@/lib/social'
import { socialDemoAllowed } from '@/lib/oauth'

/**
 * POST /api/me/verify
 * Modo demo de verificación social (sin API keys) + desconexión de proveedores.
 * Con credenciales configuradas, la verificación real pasa por el flujo OAuth
 * (/api/auth/x/start y /api/auth/google/start). La verificación demo solo
 * existe en desarrollo (ver socialDemoAllowed); desconectar vale siempre.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requireSessionUser()
    const body = await req.json()
    const provider: SocialProvider | null =
      body.provider === 'x' || body.provider === 'google' || body.provider === 'discord'
        ? body.provider
        : null
    if (!provider) return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })

    if (body.disconnect) {
      await unlinkProvider(me.id, provider)
      return NextResponse.json({ ok: true })
    }

    // Discord solo se vincula por OAuth: no tiene modo demo, así que aquí solo
    // puede llegar a desconectarse.
    if (provider === 'discord') {
      return NextResponse.json({ error: 'Verifica Discord con el botón de conectar' }, { status: 403 })
    }

    if (!socialDemoAllowed(provider)) {
      return NextResponse.json({ error: 'Verifica tu cuenta con el proveedor real' }, { status: 403 })
    }

    const value = typeof body.value === 'string' ? body.value.trim() : ''
    if (!value) return NextResponse.json({ error: 'Falta el valor a verificar' }, { status: 400 })

    const { pointsEarned } = await linkProvider(me.id, provider, value)
    return NextResponse.json({ ok: true, pointsEarned })
  } catch (e) {
    if (e instanceof SocialError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: errorStatus(e) })
  }
}
