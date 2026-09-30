import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { CodeRateLimitError, sendCode } from '@/lib/email-codes'

/**
 * POST /api/auth/password/forgot — { identifier } (usuario o correo).
 * Si la cuenta existe y tiene el correo verificado, le manda un código para
 * cambiar la contraseña. La respuesta es siempre la misma, exista o no, para
 * no revelar qué usuarios o correos están registrados.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`pw-forgot:${clientIp(req)}`, 5, 60)
  if (!limit.ok) return tooManyRequests(limit)

  const body = await req.json().catch(() => ({}))
  const identifier = String(body.identifier ?? '').trim().toLowerCase().replace(/^@/, '')
  const generic = NextResponse.json({ ok: true })
  if (!identifier) return generic

  const user = identifier.includes('@')
    ? await db.user.findFirst({ where: { email: identifier, emailVerified: true }, select: { id: true, email: true } })
    : await db.user.findUnique({ where: { handle: identifier }, select: { id: true, email: true, emailVerified: true } })
  const verified = user && user.email && ('emailVerified' in user ? user.emailVerified : true)
  if (!user || !verified) return generic

  // Sin esperar al envío: si la respuesta tardara más cuando la cuenta existe,
  // el tiempo delataría qué usuarios hay. Si ya se mandó uno hace poco
  // (CodeRateLimitError), el que le llegó sigue sirviendo.
  sendCode(user.id, 'reset_password', user.email!).catch((e) => {
    if (!(e instanceof CodeRateLimitError)) console.error('[password/forgot]', e)
  })
  return generic
}
