import { NextRequest, NextResponse } from 'next/server'
import {
  GOOGLE_AUTH_URL,
  GOOGLE_SCOPE,
  appOrigin,
  getGoogleConfig,
  oauthCookieOptions,
  randomToken,
} from '@/lib/oauth'

/**
 * GET /api/auth/google/start
 * Inicia el flujo OAuth 2.0 de Google (OpenID Connect) para verificar el email.
 * - Con credenciales → redirige a la pantalla real de Google.
 * - Sin credenciales → responde { mode: 'demo' }.
 */
export async function GET(req: NextRequest) {
  const cfg = getGoogleConfig()
  if (!cfg) {
    return NextResponse.json({ mode: 'demo', provider: 'google' })
  }

  const origin = appOrigin(req)
  const state = randomToken(24)

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    state,
    prompt: 'select_account',
    include_granted_scopes: 'true',
  })

  const res = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
  res.cookies.set('cabal_og_state', state, oauthCookieOptions(req))
  return res
}
