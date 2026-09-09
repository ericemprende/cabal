import { NextRequest, NextResponse } from 'next/server'
import {
  X_AUTH_URL,
  X_SCOPE,
  appOrigin,
  getXConfig,
  oauthCookieOptions,
  pkceChallenge,
  randomToken,
} from '@/lib/oauth'

/**
 * GET /api/waitlist/x/start
 * Arranca el OAuth 2.0 (Authorization Code + PKCE) de X para apuntarse a la
 * lista de espera. Es un flujo aparte del de /api/auth/x: usa sus propias
 * cookies de estado y vuelve siempre a /whitelist.
 * ?ref=<handle> propaga quién invitó al usuario.
 */
export async function GET(req: NextRequest) {
  const cfg = getXConfig()
  if (!cfg) return NextResponse.redirect(`${appOrigin(req)}/?wl_error=no_config`)

  const origin = appOrigin(req)
  const state = randomToken(24)
  const verifier = randomToken(48)
  const ref = req.nextUrl.searchParams.get('ref')?.replace(/^@+/, '').slice(0, 30) ?? ''

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: `${origin}/api/waitlist/x/callback`,
    scope: X_SCOPE,
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
  })

  const res = NextResponse.redirect(`${X_AUTH_URL}?${params.toString()}`)
  const opts = oauthCookieOptions(req)
  res.cookies.set('cabal_wl_state', state, opts)
  res.cookies.set('cabal_wl_verifier', verifier, opts)
  if (ref) res.cookies.set('cabal_wl_ref', ref, opts)
  return res
}
