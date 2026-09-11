import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { toUserDTO } from '@/lib/serializers'
import { checkCode, emailTakenByOther } from '@/lib/email-codes'
import { queueGhlSync } from '@/lib/ghl'

/** POST /api/me/email/verify — { code } confirma el correo al que se mandó el último código. */
export async function POST(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    const body = await req.json().catch(() => ({}))

    const result = await checkCode(userId, 'verify_email', String(body.code ?? ''))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    // Gana quien lo verifica primero: pudo verificarlo otra cuenta mientras tanto
    if (await emailTakenByOther(result.email, userId)) {
      return NextResponse.json({ error: 'Ese correo ya lo verificó otra cuenta' }, { status: 409 })
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { email: result.email, emailVerified: true },
    })
    queueGhlSync(userId)
    return NextResponse.json({ ok: true, user: toUserDTO(user) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
