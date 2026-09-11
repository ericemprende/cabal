import { NextResponse } from 'next/server'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { toUserDTO } from '@/lib/serializers'
import { SESSION_COOKIE, createSessionValue, hashPassword, sessionCookieOptions } from '@/lib/auth'
import { emailTakenByOther, isValidEmail, sendCode } from '@/lib/email-codes'
import { queueGhlSync } from '@/lib/ghl'

// POST /api/auth/register — crea una cuenta (handle + password + correo) y entra con ella.
// Acepta `referralCode` opcional: vincula al invitador (gana % de los puntos del invitado).
// El correo queda pendiente de verificar: se manda un código y la respuesta dice
// si salió (`verification.sent`), para que el diálogo lo pida a continuación.
export async function POST(req: Request) {
  try {
    // Fuerza bruta: 5 intentos por IP y minuto.
    const limit = await rateLimit(`register:${clientIp(req)}`, 5, 60)
    if (!limit.ok) return tooManyRequests(limit)

    await ensureSeeded()
    const body = await req.json()
    const handle = String(body.handle ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const referralCode = String(body.referralCode ?? '').trim().toUpperCase()

    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      return NextResponse.json(
        { error: 'El usuario debe tener 3-20 caracteres: letras, números o _' },
        { status: 400 }
      )
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Escribe un correo válido' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña necesita al menos 6 caracteres' }, { status: 400 })
    }
    const exists = await db.user.findUnique({ where: { handle } })
    if (exists) {
      return NextResponse.json({ error: 'Ese usuario ya existe. Prueba con otro.' }, { status: 409 })
    }
    if (await emailTakenByOther(email)) {
      return NextResponse.json({ error: 'Ese correo ya lo usa otra cuenta. Inicia sesión con ella.' }, { status: 409 })
    }

    // Código de invitación (opcional)
    let referredById: string | undefined
    if (referralCode) {
      const referrer = await db.user.findUnique({ where: { referralCode } })
      if (!referrer) {
        return NextResponse.json({ error: 'El código de invitación no es válido' }, { status: 400 })
      }
      referredById = referrer.id
    }

    const user = await db.user.create({
      data: {
        handle,
        name: (name || handle).slice(0, 40),
        email,
        passwordHash: hashPassword(password),
        ...(referredById ? { referredById } : {}),
      },
    })

    // Alta en el CRM y código de verificación: ninguno de los dos puede tumbar
    // el registro, que ya está hecho.
    queueGhlSync(user.id)
    let verification: { sent: boolean; emailHint: string | null } = { sent: false, emailHint: null }
    try {
      const { emailHint } = await sendCode(user.id, 'verify_email', email)
      verification = { sent: true, emailHint }
    } catch (e) {
      console.warn('[register] no se pudo enviar el código de verificación:', (e as Error).message)
    }

    const res = NextResponse.json({ ok: true, user: toUserDTO(user), verification }, { status: 201 })
    res.cookies.set(SESSION_COOKIE, createSessionValue(user.id), sessionCookieOptions())
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
