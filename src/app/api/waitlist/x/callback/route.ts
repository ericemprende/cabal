import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from '@/lib/auth'
import { X_TOKEN_URL, X_ME_URL, appOrigin, cookieSecureFlag, getXConfig } from '@/lib/oauth'
import { loginOrCreateSocial, SocialError } from '@/lib/social'
import { clientIp } from '@/lib/rate-limit'
import { WAITLIST_COOKIE, createWaitlistCookie, waitlistCookieOptions } from '@/lib/waitlist'
import { cookieDomain } from '@/lib/cookie-domain'

/**
 * GET /api/waitlist/x/callback
 * Cierra el OAuth de la lista de espera: valida state + PKCE, lee el perfil
 * real de X y da de alta (o actualiza) la entrada en WaitlistEntry.
 * De paso crea la cuenta Cabal con esa identidad, para que el usuario ya la
 * tenga lista cuando el admin lo habilite.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req)
  const secure = cookieSecureFlag(req)
  const cfg = getXConfig()

  const clearState = (res: NextResponse) => {
    for (const c of ['cabal_wl_state', 'cabal_wl_verifier', 'cabal_wl_ref']) {
      res.cookies.set(c, '', { path: '/', maxAge: 0, ...cookieDomain() })
    }
    return res
  }
  const fail = (code: string) =>
    clearState(NextResponse.redirect(`${origin}/?wl_error=${code}`))

  if (!cfg) return fail('no_config')

  const url = new URL(req.url)
  if (url.searchParams.get('error')) return fail('access_denied')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = req.cookies.get('cabal_wl_state')?.value
  const verifier = req.cookies.get('cabal_wl_verifier')?.value
  const ref = req.cookies.get('cabal_wl_ref')?.value || null
  if (!code || !state || !savedState || !verifier || state !== savedState) return fail('state')

  try {
    // 1. Código → access token (cliente confidencial: Basic auth)
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
        redirect_uri: `${origin}/api/waitlist/x/callback`,
        code_verifier: verifier,
        client_id: cfg.clientId,
      }),
    })
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string }
    if (!tokenRes.ok || !tokenJson.access_token) return fail('token')

    // 2. Perfil oficial, con las señales que el admin usará para filtrar bots
    const fields = 'profile_image_url,public_metrics,created_at,verified,description'
    const meRes = await fetch(`${X_ME_URL}?user.fields=${fields}`, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const meJson = (await meRes.json().catch(() => ({}))) as {
      data?: {
        id?: string
        username?: string
        name?: string
        profile_image_url?: string
        created_at?: string
        verified?: boolean
        public_metrics?: { followers_count?: number }
      }
    }
    const p = meJson.data
    if (!p?.id || !p.username) return fail('profile')

    // 3. Cuenta Cabal asociada (idempotente: si ya existe, la reutiliza)
    let userId: string | null = null
    try {
      const { user } = await loginOrCreateSocial(
        'x',
        p.username,
        p.name,
        p.profile_image_url?.replace('_normal', '_400x400')
      )
      userId = user.id
    } catch (e) {
      if (!(e instanceof SocialError)) throw e // handle raro de X: seguimos sin cuenta
    }

    // La relación entrada↔cuenta es 1:1. Si esa cuenta Cabal ya está atada a
    // otra entrada (p. ej. el usuario cambió de @handle), no la reasignamos.
    if (userId) {
      const taken = await db.waitlistEntry.findUnique({ where: { userId } })
      if (taken && taken.xId !== p.id) userId = null
    }

    // 4. Alta o actualización de la entrada en la lista (clave estable: xId)
    const profile = {
      xHandle: p.username,
      xName: (p.name ?? p.username).slice(0, 60),
      // _normal → _400x400: la miniatura por defecto de X es de 48px
      xAvatar: p.profile_image_url?.replace('_normal', '_400x400') ?? null,
      xFollowers: p.public_metrics?.followers_count ?? 0,
      xVerified: Boolean(p.verified),
      xCreatedAt: p.created_at ? new Date(p.created_at) : null,
    }
    const entry = await db.waitlistEntry.upsert({
      where: { xId: p.id },
      update: { ...profile, ...(userId ? { userId } : {}) },
      create: {
        xId: p.id,
        ...profile,
        ...(userId ? { userId } : {}),
        referredBy: ref,
        // Sin revisión manual: quien se registra entra directo a la app
        status: 'approved',
        approvedAt: new Date(),
        ip: clientIp(req),
        userAgent: (req.headers.get('user-agent') ?? '').slice(0, 200),
      },
    })

    // 5. Árbol de afiliados: quien llegó por ?ref= queda colgado del que le
    // invitó, y a partir de ahí awardPoints le abona el % configurado (10%)
    // de todos los puntos que genere.
    if (userId && ref) {
      try {
        const inviter = await db.waitlistEntry.findFirst({
          where: { xHandle: { equals: ref, mode: 'insensitive' } },
          select: { userId: true },
        })
        const me = await db.user.findUnique({
          where: { id: userId },
          select: { referredById: true },
        })
        // Solo la primera vez, y nunca a uno mismo
        if (inviter?.userId && inviter.userId !== userId && !me?.referredById) {
          await db.user.update({
            where: { id: userId },
            data: { referredById: inviter.userId },
          })
        }
      } catch {
        // El enlace de afiliado es accesorio: nunca debe tumbar el registro
      }
    }

    const res = clearState(NextResponse.redirect(`${origin}/whitelist?wl=ok`))
    res.cookies.set(WAITLIST_COOKIE, createWaitlistCookie(entry.id), waitlistCookieOptions(secure))
    if (userId) res.cookies.set(SESSION_COOKIE, createSessionValue(userId), sessionCookieOptions())
    return res
  } catch {
    return fail('server')
  }
}
