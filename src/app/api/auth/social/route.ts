import { NextRequest, NextResponse } from 'next/server'
import { ensureSeeded } from '@/lib/seed'
import { toUserDTO } from '@/lib/serializers'
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from '@/lib/auth'
import { loginOrCreateSocial, SocialError, SocialProvider } from '@/lib/social'
import { socialDemoAllowed } from '@/lib/oauth'

/**
 * POST /api/auth/social
 * Login/registro con identidad social en modo demo (sin API keys configuradas).
 * Simula lo que haría el callback OAuth real con mode=login: busca al usuario
 * por su @usuario de X o email de Google y, si no existe, crea la cuenta.
 * Con credenciales reales el flujo pasa por /api/auth/{provider}/start?mode=login.
 *
 * Solo responde en desarrollo y para proveedores sin credenciales (ver
 * socialDemoAllowed): la identidad no la comprueba nadie.
 */
export async function POST(req: NextRequest) {
  try {
    await ensureSeeded()
    const body = await req.json()
    const provider =
      body.provider === 'x' || body.provider === 'google' ? (body.provider as SocialProvider) : null
    if (!provider) return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
    if (!socialDemoAllowed(provider)) {
      return NextResponse.json({ error: 'Entra con tu cuenta real del proveedor' }, { status: 403 })
    }

    const value = typeof body.value === 'string' ? body.value.trim() : ''
    if (!value) return NextResponse.json({ error: 'Falta la cuenta del proveedor' }, { status: 400 })

    const name = typeof body.name === 'string' ? body.name : undefined
    const { user, created } = await loginOrCreateSocial(provider, value, name)

    const res = NextResponse.json({ ok: true, created, user: toUserDTO(user) })
    res.cookies.set(SESSION_COOKIE, createSessionValue(user.id), sessionCookieOptions())
    return res
  } catch (e) {
    if (e instanceof SocialError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
