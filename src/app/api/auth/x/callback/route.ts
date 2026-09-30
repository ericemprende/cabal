import { NextRequest, NextResponse } from 'next/server'
import { oauthFinish, oauthLinkUserId } from '@/lib/app-handoff'
import { X_TOKEN_URL, X_ME_URL, appOrigin, getXConfig } from '@/lib/oauth'
import { linkProvider, loginOrCreateSocial, SocialError } from '@/lib/social'
import { cookieDomain } from '@/lib/cookie-domain'

/**
 * GET /api/auth/x/callback
 * Callback OAuth de X: valida state + PKCE, intercambia el código por un access
 * token y lee el perfil oficial (/2/users/me).
 * - Modo verificación (default): vincula el @usuario al perfil actual.
 * - Modo login (?mode=login en start): inicia sesión o crea cuenta con esa
 *   identidad de X y establece la cookie de sesión.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req)
  const cfg = getXConfig()
  if (!cfg) return NextResponse.redirect(`${origin}/app?connected=x&connect_error=no_config`)

  const loginMode = req.cookies.get('cabal_ox_mode')?.value === 'login'
  const url = new URL(req.url)
  const providerError = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = req.cookies.get('cabal_ox_state')?.value
  const verifier = req.cookies.get('cabal_ox_verifier')?.value

  const finish = (query: string, loginUserId?: string) => {
    const res = oauthFinish(req, origin, 'x', query, loginUserId)
    res.cookies.set('cabal_ox_state', '', { path: '/', maxAge: 0, ...cookieDomain() })
    res.cookies.set('cabal_ox_verifier', '', { path: '/', maxAge: 0, ...cookieDomain() })
    res.cookies.set('cabal_ox_mode', '', { path: '/', maxAge: 0, ...cookieDomain() })
    return res
  }

  if (providerError) return finish('connect_error=access_denied')
  if (!code || !state || !savedState || !verifier || state !== savedState) {
    return finish('connect_error=state')
  }

  try {
    // 1. Intercambiar código por access token (cliente confidencial → Basic auth)
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
    const tokenRes = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${origin}/api/auth/x/callback`,
        code_verifier: verifier,
        client_id: cfg.clientId,
      }),
    })
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string
    }
    if (!tokenRes.ok || !tokenJson.access_token) return finish('connect_error=token')

    // 2. Leer el perfil oficial del usuario en X
    const meRes = await fetch(`${X_ME_URL}?user.fields=profile_image_url`, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const meJson = (await meRes.json().catch(() => ({}))) as {
      data?: { username?: string; name?: string; profile_image_url?: string }
    }
    const username = meJson.data?.username
    if (!username) return finish('connect_error=profile')
    // X devuelve la miniatura de 48px; la de 400x400 se ve nítida en el perfil
    const photo = meJson.data?.profile_image_url?.replace('_normal', '_400x400')

    // 3. Login social: entrar/crear cuenta con la identidad de X
    if (loginMode) {
      const { user, created } = await loginOrCreateSocial('x', username, meJson.data?.name, photo)
      return finish(created ? 'ok=1&login=1&created=1' : 'ok=1&login=1', user.id)
    }

    // 4. Modo verificación: vincular la cuenta al usuario actual
    // Solo una sesión real (o la de la app, vía token): nunca la cuenta demo
    const meId = await oauthLinkUserId(req)
    if (!meId) return finish('connect_error=login')
    await linkProvider(meId, 'x', username, photo)
    return finish('ok=1')
  } catch (e) {
    if (e instanceof SocialError) return finish('connect_error=profile')
    return finish('connect_error=server')
  }
}
