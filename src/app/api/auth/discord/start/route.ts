import { NextRequest, NextResponse } from 'next/server'
import {
  DISCORD_AUTH_URL,
  DISCORD_SCOPE,
  appOrigin,
  getDiscordConfig,
  oauthCookieOptions,
  randomToken,
} from '@/lib/oauth'

/**
 * GET /api/auth/discord/start
 * Inicia el flujo OAuth 2.0 de Discord para verificar la cuenta.
 *
 * A diferencia de X y Google no hay modo demo: Discord solo sirve para
 * verificar, nunca para entrar, así que sin credenciales simplemente no se
 * ofrece el botón (el estado lo da /api/auth/status).
 */
export async function GET(req: NextRequest) {
  const cfg = await getDiscordConfig()
  if (!cfg) {
    return NextResponse.json({ error: 'Discord no está configurado' }, { status: 503 })
  }

  const origin = appOrigin(req)
  const state = randomToken(24)

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: `${origin}/api/auth/discord/callback`,
    response_type: 'code',
    scope: DISCORD_SCOPE,
    state,
    // Sin esto Discord recuerda el consentimiento y no deja cambiar de cuenta,
    // que es justo lo que hace falta si alguien se equivocó de perfil.
    prompt: 'consent',
  })

  const res = NextResponse.redirect(`${DISCORD_AUTH_URL}?${params.toString()}`)
  res.cookies.set('cabal_dc_state', state, oauthCookieOptions(req))
  return res
}
