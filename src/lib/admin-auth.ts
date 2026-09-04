import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Autenticación del panel de administración en /admin.
 * Credenciales por variable de entorno (con defaults para demo):
 *   ADMIN_USER (default: admin), ADMIN_PASSWORD (default: admin123@), ADMIN_SECRET.
 * La sesión vive en una cookie httpOnly firmada con HMAC-SHA256 (8 horas).
 */

export const ADMIN_COOKIE = 'cabal_admin_session'
const TTL_MS = 8 * 60 * 60 * 1000

function creds() {
  return {
    user: process.env.ADMIN_USER?.trim() || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123@',
    secret: process.env.ADMIN_SECRET || 'cabal-admin-secret-v1',
  }
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function verifyCredentials(user: string, password: string): boolean {
  const c = creds()
  return user.trim().toLowerCase() === c.user.toLowerCase() && password === c.password
}

export function createSessionToken(): string {
  const exp = Date.now() + TTL_MS
  return `${exp}.${sign(String(exp), creds().secret)}`
}

export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const exp = Number(token.slice(0, dot))
  const sig = token.slice(dot + 1)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = sign(String(exp), creds().secret)
  if (expected.length !== sig.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch {
    return false
  }
}

/** ¿La request trae cookie de sesión admin válida? */
export function isAdminRequest(req: Request): boolean {
  const cookie = req.headers.get('cookie') ?? ''
  const match = cookie.match(new RegExp(`${ADMIN_COOKIE}=([^;]+)`))
  return verifySessionToken(match?.[1] ? decodeURIComponent(match[1]) : null)
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TTL_MS / 1000,
  }
}
