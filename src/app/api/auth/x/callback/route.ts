import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { X_TOKEN_URL, X_ME_URL, appOrigin, getXConfig } from '@/lib/oauth'
import { linkProvider, SocialError } from '@/lib/social'

/**
 * GET /api/auth/x/callback
 * Callback OAuth de X: valida state + PKCE, intercambia el código por un access
 * token, lee el perfil oficial (/2/users/me) y vincula el @usuario al perfil.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req)
  const cfg = getXConfig()
  if (!cfg) return NextResponse.redirect(`${origin}/?connected=x&connect_error=no_config`)

  const url = new URL(req.url)
  const providerError = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = req.cookies.get('cabal_ox_state')?.value
  const verifier = req.cookies.get('cabal_ox_verifier')?.value

  const finish = (query: string) => {
    const res = NextResponse.redirect(`${origin}/?connected=x&${query}`)
    res.cookies.set('cabal_ox_state', '', { path: '/', maxAge: 0 })
    res.cookies.set('cabal_ox_verifier', '', { path: '/', maxAge: 0 })
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
      data?: { username?: string; name?: string }
    }
    const username = meJson.data?.username
    if (!username) return finish('connect_error=profile')

    // 3. Vincular la cuenta verificada al usuario actual
    const me = await getCurrentUser()
    await linkProvider(me.id, 'x', username)
    return finish('ok=1')
  } catch (e) {
    if (e instanceof SocialError) return finish('connect_error=profile')
    return finish('connect_error=server')
  }
}
