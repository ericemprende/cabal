import { NextResponse, type NextRequest } from 'next/server'

/**
 * Dominio canónico (fase beta: beta.cabal.army). Si CANONICAL_HOST está
 * definido, quien entre por otro dominio (cabal.army, www.cabal.army) se
 * redirige al canónico con la misma ruta: cabal.army/app → beta.cabal.army/app.
 *
 * /api queda fuera: los webhooks (Stripe, NOWPayments, Telegram…) no siguen
 * redirecciones y deben seguir funcionando en el dominio viejo. /.well-known
 * tampoco: la verificación de la app de Android (assetlinks.json) no las sigue.
 */
export function proxy(req: NextRequest) {
  const canonical = process.env.CANONICAL_HOST
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(':')[0].toLowerCase()
  if (!canonical || !host || host === canonical || host === 'localhost' || host === '127.0.0.1') {
    return NextResponse.next()
  }
  // Solo se redirige desde el dominio principal y sus subdominios conocidos
  const root = canonical.split('.').slice(-2).join('.')
  if (host !== root && host !== `www.${root}`) return NextResponse.next()

  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${canonical}`)
  return NextResponse.redirect(url, 308)
}

export const config = {
  matcher: ['/((?!api/|_next/|uploads/|\\.well-known/).*)'],
}
