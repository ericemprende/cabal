import { NextResponse } from 'next/server'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { toUserDTO } from '@/lib/serializers'
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions, verifyPassword } from '@/lib/auth'
import { CodeRateLimitError, liveLoginChallenge, sendCode, twoFactorRequired } from '@/lib/email-codes'

// POST /api/auth/login — entra con handle + password.
// Con verificación en dos pasos (la del usuario o la que exige el admin), la
// contraseña no abre sesión: se manda un código al correo y se responde con un
// reto (challengeId) que se completa en POST /api/auth/2fa.
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

    // Sin correo verificado no hay a dónde mandar el código: entra solo con la
    // contraseña (el perfil le invita a añadir el correo).
    const secondStep =
      Boolean(user.email && user.emailVerified) && (user.twoFactorEnabled || (await twoFactorRequired()))
    if (secondStep) {
      try {
        const challenge = await sendCode(user.id, 'login', user.email!)
        return NextResponse.json({ ok: true, twoFactor: true, challengeId: challenge.id, emailHint: challenge.emailHint })
      } catch (e) {
        if (e instanceof CodeRateLimitError) {
          const live = await liveLoginChallenge(user.id)
          if (live) return NextResponse.json({ ok: true, twoFactor: true, challengeId: live.id, emailHint: live.emailHint })
          return NextResponse.json({ error: e.message }, { status: 429 })
        }
        console.error('[login] no se pudo enviar el código', e)
        return NextResponse.json(
          { error: 'No pudimos enviarte el código de seguridad. Inténtalo en unos minutos.' },
          { status: 503 }
        )
      }
    }

    const res = NextResponse.json({ ok: true, user: toUserDTO(user) })
    res.cookies.set(SESSION_COOKIE, createSessionValue(user.id), sessionCookieOptions())
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
