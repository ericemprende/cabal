import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions, sessionUserIdFromCookies } from '@/lib/auth'
import { oauthCookieOptions } from '@/lib/oauth'
import { cookieDomain } from '@/lib/cookie-domain'
import { redis } from '@/lib/redis'

/**
 * Login con X, Google y Discord dentro de la app de iOS.
 *
 * Google no deja hacer OAuth dentro de un WebView, así que la app abre el flujo
 * en el navegador del sistema (SFSafariViewController). Ese navegador no
 * comparte cookies con la app, y de ahí salen los dos saltos que resuelve esto:
 *
 *  - Ida (solo al vincular una red desde el perfil): la app pide un token
 *    "link" con su sesión y lo pasa en la URL de start (?link=…). El callback
 *    sabe así a qué cuenta vincular, aunque en Safari no haya sesión.
 *  - Vuelta: el callback no pone la cookie (caería en Safari). Redirige a
 *    army.cabal.app://auth?t=… y la app abre /api/auth/app-handoff?t=…, que
 *    la pone ya dentro de la app.
 *
 * Los tokens van firmados, caducan en minutos y, con Redis, valen una sola vez.
 */
export const APP_SCHEME = 'army.cabal.app'
/** Paquete de la app Android (TWA, carpeta android/). */
const ANDROID_PACKAGE = 'army.cabal.app'

const APP_COOKIE = 'cabal_oauth_app'
const LINK_COOKIE = 'cabal_oauth_link'

type Purpose = 'login' | 'link'
const TTL: Record<Purpose, number> = { login: 120, link: 600 }

function secret(): string {
  return process.env.AUTH_SECRET || process.env.ADMIN_SECRET || process.env.DATABASE_URL || 'cabal-handoff-dev'
}

function sign(payload: string): string {
  return createHmac('sha256', `handoff:${secret()}`).update(payload).digest('base64url')
}

export function createHandoffToken(userId: string, purpose: Purpose): string {
  const exp = Math.floor(Date.now() / 1000) + TTL[purpose]
  const payload = `${userId}.${exp}.${purpose}`
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`
}

/** userId del token si es válido, de ese propósito, no ha caducado y no se usó ya. */
export async function consumeHandoffToken(token: string | null | undefined, purpose: Purpose): Promise<string | null> {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = Buffer.from(token.slice(0, dot), 'base64url').toString()
  const sig = token.slice(dot + 1)
  const expected = sign(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  const [userId, expRaw, p] = payload.split('.')
  if (!userId || p !== purpose || !(Number(expRaw) * 1000 > Date.now())) return null
  if (redis) {
    try {
      const fresh = await redis.set(`cabal:handoff:${sig}`, '1', 'EX', TTL[purpose], 'NX')
      if (fresh !== 'OK') return null
    } catch {
      /* Redis caído: vale la caducidad corta */
    }
  }
  return userId
}

/** En /start: recuerda (en el navegador del sistema) que el flujo viene de la app. */
export function markAppOAuth(req: NextRequest, res: NextResponse) {
  const params = req.nextUrl.searchParams
  const app = params.get('app')
  if (app !== '1' && app !== 'android') return
  const opts = oauthCookieOptions(req)
  res.cookies.set(APP_COOKIE, app, opts)
  const link = params.get('link')
  if (link && link.length < 400) res.cookies.set(LINK_COOKIE, link, opts)
}

/** Cuenta a la que vincular en modo verificación: la del token de la app o la sesión. */
export async function oauthLinkUserId(req: NextRequest): Promise<string | null> {
  const fromApp = await consumeHandoffToken(req.cookies.get(LINK_COOKIE)?.value, 'link')
  return fromApp ?? (await sessionUserIdFromCookies())
}

/**
 * Respuesta final de un callback OAuth. En la web vuelve a /app (y pone la
 * sesión si es un login); si el flujo vino de la app, vuelve a la app por su
 * esquema con un token de un solo uso en lugar de la cookie.
 */
export function oauthFinish(
  req: NextRequest,
  origin: string,
  provider: string,
  query: string,
  loginUserId?: string
): NextResponse {
  const fromApp = req.cookies.get(APP_COOKIE)?.value
  let res: NextResponse
  if (fromApp === 'android') {
    // App de Android (TWA): X o Google sueltan a la persona en el navegador.
    // Un enlace intent:// la devuelve a la app, que abre el traspaso y pone la
    // sesión dentro; si no se puede abrir la app, el navegador sigue al mismo
    // enlace https y la sesión queda al menos ahí.
    const t = loginUserId ? createHandoffToken(loginUserId, 'login') : null
    const target = t
      ? `${origin}/api/auth/app-handoff?p=${provider}&t=${encodeURIComponent(t)}${query.includes('created=1') ? '&created=1' : ''}`
      : `${origin}/app?connected=${provider}&${query}`
    const u = new URL(target)
    res = NextResponse.redirect(
      `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(target)};end`
    )
  } else if (fromApp === '1') {
    const t = loginUserId ? `&t=${encodeURIComponent(createHandoffToken(loginUserId, 'login'))}` : ''
    res = NextResponse.redirect(`${APP_SCHEME}://auth?p=${provider}&${query}${t}`)
  } else {
    res = NextResponse.redirect(`${origin}/app?connected=${provider}&${query}`)
    if (loginUserId) res.cookies.set(SESSION_COOKIE, createSessionValue(loginUserId), sessionCookieOptions())
  }
  res.cookies.set(APP_COOKIE, '', { path: '/', maxAge: 0, ...cookieDomain() })
  res.cookies.set(LINK_COOKIE, '', { path: '/', maxAge: 0, ...cookieDomain() })
  return res
}
