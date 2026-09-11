import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { CodeRateLimitError, emailTakenByOther, isValidEmail, sendCode } from '@/lib/email-codes'
import { EmailNotConfiguredError } from '@/lib/email'

/**
 * POST /api/me/email — { email }
 * Añade o cambia el correo de la cuenta y manda el código para verificarlo.
 * Un correo ya verificado se conserva hasta que se verifica el nuevo: cambiarlo
 * no puede dejar la cuenta sin correo (ni sin 2FA) por un error al teclear.
 */
export async function POST(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    const limit = await rateLimit(`me-email:${clientIp(req)}`, 10, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!isValidEmail(email)) return NextResponse.json({ error: 'Escribe un correo válido' }, { status: 400 })

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } })
    if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    if (user.email === email && user.emailVerified) {
      return NextResponse.json({ error: 'Ese correo ya está verificado en tu cuenta' }, { status: 400 })
    }
    if (await emailTakenByOther(email, userId)) {
      return NextResponse.json({ error: 'Ese correo ya lo usa otra cuenta' }, { status: 409 })
    }
    // Sin correo verificado, el nuevo se guarda ya (pendiente de verificar)
    if (!user.emailVerified) {
      await db.user.update({ where: { id: userId }, data: { email, emailVerified: false } })
    }

    const { emailHint } = await sendCode(userId, 'verify_email', email)
    return NextResponse.json({ ok: true, sent: true, emailHint })
  } catch (e) {
    if (e instanceof CodeRateLimitError) return NextResponse.json({ error: e.message }, { status: 429 })
    if (e instanceof EmailNotConfiguredError) return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('[me/email]', e)
    return NextResponse.json({ error: 'No pudimos enviar el código. Inténtalo en unos minutos.' }, { status: 502 })
  }
}
