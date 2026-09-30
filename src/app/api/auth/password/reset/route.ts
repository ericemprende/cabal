import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { toUserDTO } from '@/lib/serializers'
import { SESSION_COOKIE, createSessionValue, hashPassword, sessionCookieOptions } from '@/lib/auth'
import { checkCode } from '@/lib/email-codes'
import { passwordChangedEmail, sendEmail } from '@/lib/email'
import { siteUrl } from '@/lib/waitlist'

/**
 * POST /api/auth/password/reset — { identifier, code, password }.
 * Comprueba el código de /forgot, cambia la contraseña, avisa por correo y
 * abre la sesión (el código ya demuestra que es el dueño del correo).
 */
export async function POST(req: Request) {
  try {
    const limit = await rateLimit(`pw-reset:${clientIp(req)}`, 10, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const identifier = String(body.identifier ?? '').trim().toLowerCase().replace(/^@/, '')
    const password = String(body.password ?? '')
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña necesita al menos 6 caracteres' }, { status: 400 })
    }

    const user = identifier.includes('@')
      ? await db.user.findFirst({ where: { email: identifier, emailVerified: true } })
      : await db.user.findUnique({ where: { handle: identifier } })
    if (!user) return NextResponse.json({ error: 'El código caducó. Pide uno nuevo.' }, { status: 400 })

    const result = await checkCode(user.id, 'reset_password', String(body.code ?? ''))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    const updated = await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } })
    sendEmail({ to: result.email, ...passwordChangedEmail(user.handle, `${siteUrl()}/app`) }).catch((e) =>
      console.warn('[password/reset] no se pudo mandar el aviso:', (e as Error).message)
    )

    const res = NextResponse.json({ ok: true, user: toUserDTO(updated) })
    res.cookies.set(SESSION_COOKIE, createSessionValue(user.id), sessionCookieOptions())
    return res
  } catch (e) {
    console.error('[password/reset]', e)
    return NextResponse.json({ error: 'No pudimos cambiar la contraseña' }, { status: 500 })
  }
}
