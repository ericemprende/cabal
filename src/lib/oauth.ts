import { createHash, randomBytes } from 'node:crypto'

/**
 * Utilidades OAuth 2.0 para conectar las APIs de X (Twitter) y Google.
 *
 * Credenciales por variable de entorno:
 *  - X:      X_CLIENT_ID, X_CLIENT_SECRET       (developer.x.com → OAuth 2.0 Web App)
 *  - Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (console.cloud.google.com → OAuth Client ID)
 *  - Opcional: APP_ORIGIN para forzar el dominio público usado en las redirect URIs.
 *
 * Cuando las credenciales existen, la app ejecuta el flujo OAuth 2.0 real
 * (Authorization Code + PKCE). Si no, el frontend muestra una pantalla de
 * consentimiento simulada y la verificación pasa por /api/me/verify (modo demo).
 */

// ---------- Origen público de la app (para calcular las redirect URIs) ----------
export function appOrigin(req: Request): string {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/+$/, '')
  const h = req.headers
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'http'
  const host =
    h.get('x-forwarded-host')?.split(',')[0]?.trim() ?? h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}`
}

// ---------- Credenciales ----------
export function getXConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.X_CLIENT_ID?.trim()
  const clientSecret = process.env.X_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function getGoogleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

// ---------- Modo demo ----------
/**
 * El modo demo (entrar o verificar una identidad social sin pasar por el
 * proveedor) solo existe en desarrollo y para proveedores sin credenciales.
 * En cualquier otro caso bastaría con escribir el @usuario de X o el correo de
 * Google de otra persona para entrar en su cuenta.
 */
export function socialDemoAllowed(provider: 'x' | 'google'): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return provider === 'x' ? !getXConfig() : !getGoogleConfig()
}

// ---------- PKCE (X exige code_challenge S256) ----------
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// ---------- Cookies de estado (CSRF + PKCE verifier) ----------
export function cookieSecureFlag(req: Request): boolean {
  return (req.headers.get('x-forwarded-proto') ?? '').includes('https')
}

export function oauthCookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutos
    secure: cookieSecureFlag(req),
  }
}

// ---------- Endpoints de los proveedores ----------
export const X_AUTH_URL = 'https://x.com/i/oauth2/authorize'
export const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token'
export const X_ME_URL = 'https://api.x.com/2/users/me'

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export const X_SCOPE = 'users.read tweet.read offline.access'
export const GOOGLE_SCOPE = 'openid email profile'
