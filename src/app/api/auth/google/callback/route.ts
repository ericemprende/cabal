import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from '@/lib/auth'
import { GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, appOrigin, getGoogleConfig } from '@/lib/oauth'
import { linkProvider, loginOrCreateSocial, SocialError } from '@/lib/social'
import { cookieDomain } from '@/lib/cookie-domain'

/**
 * GET /api/auth/google/callback
 * Callback OAuth de Google: valida state, intercambia el código y lee el perfil
 * OpenID (email verificado por Google).
 * - Modo verificación (default): vincula el email al perfil actual.
 * - Modo login (?mode=login en start): inicia sesión o crea cuenta con ese
 *   email y establece la cookie de sesión.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req)
  const cfg = getGoogleConfig()
  if (!cfg) return NextResponse.redirect(`${origin}/app?connected=google&connect_error=no_config`)

  const loginMode = req.cookies.get('cabal_og_mode')?.value === 'login'
  const url = new URL(req.url)
  const providerError = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = req.cookies.get('cabal_og_state')?.value

  const finish = (query: string) => {
    const res = NextResponse.redirect(`${origin}/app?connected=google&${query}`)
    res.cookies.set('cabal_og_state', '', { path: '/', maxAge: 0, ...cookieDomain() })
    res.cookies.set('cabal_og_mode', '', { path: '/', maxAge: 0, ...cookieDomain() })
    return res
  }

  if (providerError) return finish('connect_error=access_denied')
  if (!code || !state || !savedState || state !== savedState) {
    return finish('connect_error=state')
  }

  try {
    // 1. Intercambiar código por access token
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string }
    if (!tokenRes.ok || !tokenJson.access_token) return finish('connect_error=token')

    // 2. Perfil OpenID Connect (email verificado por Google)
    const uiRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const uiJson = (await uiRes.json().catch(() => ({}))) as { email?: string; name?: string }
    if (!uiJson.email) return finish('connect_error=profile')

    // 3. Login social: entrar/crear cuenta con el email de Google
    if (loginMode) {
      const { user, created } = await loginOrCreateSocial('google', uiJson.email, uiJson.name)
      const res = finish(created ? 'ok=1&login=1&created=1' : 'ok=1&login=1')
      res.cookies.set(SESSION_COOKIE, createSessionValue(user.id), sessionCookieOptions())
      return res
    }

    // 4. Modo verificación: vincular la cuenta verificada
    const me = await getCurrentUser()
    await linkProvider(me.id, 'google', uiJson.email)
    return finish('ok=1')
  } catch (e) {
    if (e instanceof SocialError) return finish('connect_error=profile')
    return finish('connect_error=server')
  }
}
