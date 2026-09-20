import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { DISCORD_ME_URL, DISCORD_TOKEN_URL, appOrigin, getDiscordConfig } from '@/lib/oauth'
import { linkProvider, SocialError } from '@/lib/social'

/**
 * GET /api/auth/discord/callback
 * Callback OAuth de Discord: valida state, intercambia el código y lee el
 * perfil (`/users/@me`, scope identify).
 *
 * Solo modo verificación: vincula la cuenta de Discord al perfil actual. No hay
 * modo login como en X o Google — Discord no da un correo con `identify`, así
 * que no serviría para crear una cuenta completa.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req)
  const cfg = await getDiscordConfig()
  if (!cfg) return NextResponse.redirect(`${origin}/app?connected=discord&connect_error=no_config`)

  const url = new URL(req.url)
  const providerError = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = req.cookies.get('cabal_dc_state')?.value

  const finish = (query: string) => {
    const res = NextResponse.redirect(`${origin}/app?connected=discord&${query}`)
    res.cookies.set('cabal_dc_state', '', { path: '/', maxAge: 0 })
    return res
  }

  if (providerError) return finish('connect_error=access_denied')
  if (!code || !state || !savedState || state !== savedState) {
    return finish('connect_error=state')
  }

  try {
    // 1. Intercambiar código por access token
    const tokenRes = await fetch(DISCORD_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: `${origin}/api/auth/discord/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string }
    if (!tokenRes.ok || !tokenJson.access_token) return finish('connect_error=token')

    // 2. Perfil: id (snowflake), nombre visible y avatar
    const meRes = await fetch(DISCORD_ME_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const profile = (await meRes.json().catch(() => ({}))) as {
      id?: string
      username?: string
      global_name?: string | null
    }
    if (!profile.id) return finish('connect_error=profile')

    // 3. Vincular al perfil actual y abonar el bonus (una sola vez)
    const me = await getCurrentUser()
    await linkProvider(
      me.id,
      'discord',
      profile.id,
      undefined,
      profile.global_name || profile.username
    )
    return finish('ok=1')
  } catch (e) {
    // "Ya vinculada a otro perfil" es el único error que la persona puede
    // arreglar, así que se distingue del resto en la pantalla de vuelta.
    if (e instanceof SocialError) return finish('connect_error=taken')
    return finish('connect_error=server')
  }
}
