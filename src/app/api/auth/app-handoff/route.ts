import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from '@/lib/auth'
import { consumeHandoffToken } from '@/lib/app-handoff'
import { appOrigin } from '@/lib/oauth'

/**
 * GET /api/auth/app-handoff?t=…&p=google[&created=1]
 *
 * Última parada del login social en la app de iOS (ver lib/app-handoff.ts): la
 * app la abre ya dentro de su WebView con el token que le llegó por
 * army.cabal.app://auth, y aquí se pone la cookie de sesión donde toca.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req)
  const params = req.nextUrl.searchParams
  const provider = /^(x|google|discord)$/.test(params.get('p') ?? '') ? params.get('p') : 'google'
  const userId = await consumeHandoffToken(params.get('t'), 'login')
  if (!userId) {
    return NextResponse.redirect(`${origin}/app?connected=${provider}&connect_error=state`)
  }
  const created = params.get('created') === '1' ? '&created=1' : ''
  const res = NextResponse.redirect(`${origin}/app?connected=${provider}&ok=1&login=1${created}`)
  res.cookies.set(SESSION_COOKIE, createSessionValue(userId), sessionCookieOptions())
  return res
}
