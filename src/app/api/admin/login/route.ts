import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieOptions, createSessionToken, verifyCredentials } from '@/lib/admin-auth'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

/**
 * POST /api/admin/login — inicia sesión del panel /admin.
 * Credenciales por env (ADMIN_USER / ADMIN_PASSWORD).
 */
export async function POST(req: NextRequest) {
  // Fuerza bruta: 5 intentos por IP cada 5 minutos (la llave de todo el panel).
  const limit = await rateLimit(`admin-login:${clientIp(req)}`, 5, 300)
  if (!limit.ok) return tooManyRequests(limit)
  try {
    const body = await req.json()
    const user = String(body.user ?? '')
    const password = String(body.password ?? '')
    if (!verifyCredentials(user, password)) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(ADMIN_COOKIE, createSessionToken(), adminCookieOptions())
    return res
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }
}
