import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { CodeRateLimitError, checkCode, sendCode } from '@/lib/email-codes'
import { EmailNotConfiguredError } from '@/lib/email'

/**
 * POST /api/me/2fa — verificación en dos pasos por correo.
 *  - { action: 'request' }                 manda el código al correo verificado
 *  - { action: 'enable' | 'disable', code } la cambia si el código es bueno
 * Pedir el código también para desactivarla evita que alguien con la sesión
 * abierta en un ordenador ajeno la quite sin tener acceso al correo.
 */
export async function POST(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    const limit = await rateLimit(`me-2fa:${clientIp(req)}`, 15, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true, twoFactorEnabled: true },
    })
    if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    if (!user.email || !user.emailVerified) {
      return NextResponse.json({ error: 'Primero verifica tu correo' }, { status: 400 })
    }

    if (body.action === 'request') {
      const { emailHint } = await sendCode(userId, 'two_factor', user.email)
      return NextResponse.json({ ok: true, sent: true, emailHint })
    }

    if (body.action !== 'enable' && body.action !== 'disable') {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    }
    const result = await checkCode(userId, 'two_factor', String(body.code ?? ''))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: body.action === 'enable' } })
    return NextResponse.json({ ok: true, twoFactorEnabled: body.action === 'enable' })
  } catch (e) {
    if (e instanceof CodeRateLimitError) return NextResponse.json({ error: e.message }, { status: 429 })
    if (e instanceof EmailNotConfiguredError) return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('[me/2fa]', e)
    return NextResponse.json({ error: 'No pudimos completar la operación. Inténtalo en unos minutos.' }, { status: 502 })
  }
}
