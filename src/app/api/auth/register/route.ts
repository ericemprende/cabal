import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { toUserDTO } from '@/lib/serializers'
import { SESSION_COOKIE, createSessionValue, hashPassword, sessionCookieOptions } from '@/lib/auth'

// POST /api/auth/register — crea una cuenta (handle + password) y entra con ella
export async function POST(req: Request) {
  try {
    await ensureSeeded()
    const body = await req.json()
    const handle = String(body.handle ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const name = String(body.name ?? '').trim()

    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      return NextResponse.json(
        { error: 'El usuario debe tener 3-20 caracteres: letras, números o _' },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña necesita al menos 6 caracteres' }, { status: 400 })
    }
    const exists = await db.user.findUnique({ where: { handle } })
    if (exists) {
      return NextResponse.json({ error: 'Ese usuario ya existe. Prueba con otro.' }, { status: 409 })
    }

    const user = await db.user.create({
      data: {
        handle,
        name: (name || handle).slice(0, 40),
        passwordHash: hashPassword(password),
      },
    })

    const res = NextResponse.json({ ok: true, user: toUserDTO(user) }, { status: 201 })
    res.cookies.set(SESSION_COOKIE, createSessionValue(user.id), sessionCookieOptions())
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
