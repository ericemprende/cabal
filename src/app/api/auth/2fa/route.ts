import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { toUserDTO } from '@/lib/serializers'
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from '@/lib/auth'
import { CodeRateLimitError, checkCode, loginChallengeUser, sendCode } from '@/lib/email-codes'

/**
 * POST /api/auth/2fa — segundo paso del inicio de sesión.
 *  - { challengeId, code }          comprueba el código y abre la sesión
 *  - { challengeId, resend: true }  manda un código nuevo (devuelve otro challengeId)
 * El reto solo existe si antes se acertó la contraseña (POST /api/auth/login).
 */
export async function POST(req: Request) {
  try {
    const limit = await rateLimit(`login-2fa:${clientIp(req)}`, 15, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : ''
    const userId = challengeId ? await loginChallengeUser(challengeId) : null
    if (!userId) {
      return NextResponse.json({ error: 'El inicio de sesión caducó. Vuelve a escribir tu contraseña.' }, { status: 400 })
    }

    if (body.resend === true) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
      if (!user?.email) return NextResponse.json({ error: 'La cuenta ya no tiene correo' }, { status: 400 })
      const next = await sendCode(userId, 'login', user.email)
      return NextResponse.json({ ok: true, challengeId: next.id, emailHint: next.emailHint })
    }

    const result = await checkCode(userId, 'login', String(body.code ?? ''), challengeId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    const res = NextResponse.json({ ok: true, user: toUserDTO(user) })
    res.cookies.set(SESSION_COOKIE, createSessionValue(user.id), sessionCookieOptions())
    return res
  } catch (e) {
    if (e instanceof CodeRateLimitError) return NextResponse.json({ error: e.message }, { status: 429 })
    console.error('[auth/2fa]', e)
    return NextResponse.json({ error: 'No pudimos completar el inicio de sesión' }, { status: 502 })
  }
}
