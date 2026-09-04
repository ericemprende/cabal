import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieOptions, createSessionToken, verifyCredentials } from '@/lib/admin-auth'

/**
 * POST /api/admin/login — inicia sesión del panel /admin.
 * Credenciales por env (demo: admin / admin123@).
 */
export async function POST(req: NextRequest) {
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
