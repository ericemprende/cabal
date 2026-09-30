import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { cookieDomain } from '@/lib/cookie-domain'

/**
 * Sesión de usuario de la app (login/registro por credenciales).
 * - Password: scrypt con salt aleatorio (formato `salt:hash` en hex).
 * - Sesión: cookie httpOnly `cabal_session` = `userId.firma` (HMAC-SHA256, 30 días).
 * - Sin cookie válida la app corre en modo invitado (usuario demo "Tú").
 */

export const SESSION_COOKIE = 'cabal_session'
const TTL_S = 60 * 60 * 24 * 30

let warnedNoSecret = false

/**
 * Clave con la que se firman las sesiones. Sin AUTH_SECRET se deriva de
 * secretos que ya existen en el servidor (nunca de un texto que esté en el
 * código: con uno público cualquiera podría firmarse la sesión de otro).
 */
function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  const base = process.env.ADMIN_SECRET || process.env.DATABASE_URL || process.env.ADMIN_PASSWORD
  if (!base) return 'cabal-user-secret-dev'
  if (!warnedNoSecret) {
    warnedNoSecret = true
    console.warn('[auth] Falta AUTH_SECRET: la firma de sesiones se deriva de otros secretos. Define AUTH_SECRET.')
  }
  return createHmac('sha256', 'cabal-auth-secret').update(base).digest('hex')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  try {
    const test = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return test.length === expected.length && timingSafeEqual(test, expected)
  } catch {
    return false
  }
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url')
}

export function createSessionValue(userId: string): string {
  return `${userId}.${sign(userId)}`
}

export function readSessionValue(token: string | null | undefined): string | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const userId = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(userId)
  if (expected.length !== sig.length) return null
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) ? userId : null
  } catch {
    return null
  }
}

/**
 * Lee el userId de la cookie de sesión (server-side). Una cuenta que su dueño
 * borró no vale aunque la cookie esté bien firmada: la firma no caduca, así
 * que sin esta comprobación la sesión seguiría viva tras el borrado.
 */
export async function sessionUserIdFromCookies(): Promise<string | null> {
  try {
    const store = await cookies()
    const userId = readSessionValue(store.get(SESSION_COOKIE)?.value)
    if (!userId) return null
    const { db } = await import('@/lib/db')
    const user = await db.user.findUnique({ where: { id: userId }, select: { deletedAt: true } })
    return user && !user.deletedAt ? userId : null
  } catch {
    return null
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TTL_S,
    ...cookieDomain(),
  }
}

/** Cookie expirada para cerrar sesión. */
export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    ...cookieDomain(),
  }
}
