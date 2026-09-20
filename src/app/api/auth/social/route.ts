import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { toUserDTO } from '@/lib/serializers'
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from '@/lib/auth'
import { loginOrCreateSocial, SocialError } from '@/lib/social'
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
    // Solo X y Google: Discord nunca inicia sesión, solo verifica (con
    // `identify` no da correo, así que no alcanza para crear una cuenta).
    const provider: 'x' | 'google' | null =
      body.provider === 'x' || body.provider === 'google' ? body.provider : null
    if (!provider) return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
    if (!socialDemoAllowed(provider)) {
      return NextResponse.json({ error: 'Entra con tu cuenta real del proveedor' }, { status: 403 })
    }

    const value = typeof body.value === 'string' ? body.value.trim() : ''
    if (!value) return NextResponse.json({ error: 'Falta la cuenta del proveedor' }, { status: 400 })

    const name = typeof body.name === 'string' ? body.name : undefined
    // loginOrCreateSocial solo devuelve { id }: lo justo para abrir sesión. Aquí
    // además se enseña el perfil completo, así que se vuelve a leer entero.
    const { user: ref, created } = await loginOrCreateSocial(provider, value, name)
    const user = await db.user.findUniqueOrThrow({ where: { id: ref.id } })

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
