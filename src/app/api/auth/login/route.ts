import { NextResponse } from 'next/server'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { toUserDTO } from '@/lib/serializers'
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions, verifyPassword } from '@/lib/auth'

// POST /api/auth/login — entra con handle + password
export async function POST(req: Request) {
  try {
    // Fuerza bruta: 10 intentos por IP y minuto.
    const limit = await rateLimit(`login:${clientIp(req)}`, 10, 60)
    if (!limit.ok) return tooManyRequests(limit)

    await ensureSeeded()
    const body = await req.json()
    const handle = String(body.handle ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    const user = await db.user.findUnique({ where: { handle } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true, user: toUserDTO(user) })
    res.cookies.set(SESSION_COOKIE, createSessionValue(user.id), sessionCookieOptions())
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
