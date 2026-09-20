import { createHash, randomBytes } from 'node:crypto'

/**
 * Utilidades OAuth 2.0 para conectar las APIs de X (Twitter) y Google.
 *
 * Credenciales por variable de entorno:
 *  - X:      X_CLIENT_ID, X_CLIENT_SECRET       (developer.x.com → OAuth 2.0 Web App)
 *  - Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (console.cloud.google.com → OAuth Client ID)
 *  - Discord: DISCORD_CLIENT_SECRET (discord.com/developers → OAuth2 → Client Secret).
 *    El client_id NO hace falta configurarlo: en Discord es el mismo
 *    application id del bot, que ya se guarda al conectarlo desde /admin.
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

/**
 * Credenciales de Discord. A diferencia de X y Google, el client_id no viene de
 * una variable propia: en Discord el client_id de OAuth es el application id de
 * la misma app del bot, que ya está guardado en Setting al conectarlo desde el
 * panel. Así solo hay que añadir el secret y no se puede configurar mal.
 *
 * Es async porque el appId vive en la base de datos, no en el entorno.
 */
export async function getDiscordConfig(): Promise<{ clientId: string; clientSecret: string } | null> {
  const clientSecret =
    process.env.DISCORD_CLIENT_SECRET?.trim() || (await discordOAuthSecret())
  if (!clientSecret) return null
  const envId = process.env.DISCORD_CLIENT_ID?.trim()
  if (envId) return { clientId: envId, clientSecret }
  // Si la base de datos no responde se devuelve "sin configurar" en vez de
  // propagar el error: esto lo llama /api/auth/status, y un fallo aquí dejaría
  // también a X y Google sin poder conectarse.
  const bot = await import('@/lib/discord')
    .then((m) => m.discordConfig())
    .catch(() => null)
  if (!bot?.appId) return null
  return { clientId: bot.appId, clientSecret }
}

/** El secret guardado desde el panel, si el admin lo pegó ahí en vez del entorno. */
async function discordOAuthSecret(): Promise<string> {
  const { db } = await import('@/lib/db')
  const row = await db.setting.findUnique({ where: { key: 'discord_client_secret' } }).catch(() => null)
  return row?.value?.trim() ?? ''
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

export const DISCORD_AUTH_URL = 'https://discord.com/oauth2/authorize'
export const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token'
export const DISCORD_ME_URL = 'https://discord.com/api/users/@me'

export const X_SCOPE = 'users.read tweet.read offline.access'
export const GOOGLE_SCOPE = 'openid email profile'
/**
 * Solo `identify`: el id, el nombre y el avatar. No se pide `guilds` a
 * propósito — para saber si alguien está en un servidor ya pregunta el bot con
 * su propio token (ver lib/community-members), así que pedir la lista de
 * servidores de la persona sería recoger datos que no hacen falta.
 */
export const DISCORD_SCOPE = 'identify'
