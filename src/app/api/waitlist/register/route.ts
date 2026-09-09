import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { WAITLIST_COOKIE, readWaitlistCookie } from '@/lib/waitlist'

/**
 * POST /api/waitlist/register
 * Segundo paso de la lista de espera: el usuario ya se autenticó con X (paso 1)
 * y aquí completa los datos básicos. El nombre llega prellenado del perfil real
 * de X y el @handle no se toca (viene verificado del OAuth); el email hay que
 * escribirlo porque la API de X con OAuth 2.0 no lo entrega.
 */
const schema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre').max(60),
  email: z.string().trim().toLowerCase().email('Email inválido').max(120),
  telegram: z.string().trim().max(40).optional().default(''),
  wallet: z.string().trim().max(80).optional().default(''),
  country: z.string().trim().max(60).optional().default(''),
  reason: z.string().trim().max(300).optional().default(''),
})

export async function POST(req: Request) {
  const store = await cookies()
  const entryId = readWaitlistCookie(store.get(WAITLIST_COOKIE)?.value)
  if (!entryId) {
    return NextResponse.json({ error: 'Primero conecta tu cuenta de X' }, { status: 401 })
  }

  const rl = await rateLimit(`wl:register:${clientIp(req)}`, 10, 60)
  if (!rl.ok) return tooManyRequests(rl)

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { name, email, telegram, wallet, country, reason } = parsed.data

  const entry = await db.waitlistEntry.findUnique({ where: { id: entryId } })
  if (!entry) return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })

  const updated = await db.waitlistEntry.update({
    where: { id: entryId },
    data: {
      xName: name,
      email,
      telegram: telegram.replace(/^@+/, ''),
      wallet,
      country,
      reason,
      completed: true,
      completedAt: entry.completedAt ?? new Date(),
      ip: entry.ip || clientIp(req),
    },
  })

  // El nombre también se refleja en la cuenta Cabal creada durante el OAuth
  if (updated.userId) {
    await db.user.update({ where: { id: updated.userId }, data: { name } }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
