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
 * GET /api/auth/x/start
 * Inicia el flujo OAuth 2.0 (Authorization Code + PKCE) contra X.
 * - Con credenciales configuradas → redirige a la pantalla real de autorización de X.
 * - Sin credenciales → responde { mode: 'demo' } para que el frontend muestre
 *   la pantalla de consentimiento simulada.
 */
export async function GET(req: NextRequest) {
  const cfg = getXConfig()
  if (!cfg) {
    return NextResponse.json({ mode: 'demo', provider: 'x' })
  }

  const origin = appOrigin(req)
  const state = randomToken(24)
  const verifier = randomToken(48)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: `${origin}/api/auth/x/callback`,
    scope: X_SCOPE,
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
  })

  const res = NextResponse.redirect(`${X_AUTH_URL}?${params.toString()}`)
  const opts = oauthCookieOptions(req)
  res.cookies.set('cabal_ox_state', state, opts)
  res.cookies.set('cabal_ox_verifier', verifier, opts)
  return res
}
