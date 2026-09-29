/**
 * Dominio de las cookies de sesión y de login. Con COOKIE_DOMAIN=.cabal.army
 * la sesión vale a la vez en cabal.army y beta.cabal.army: los logins con X,
 * Google y Discord vuelven por cabal.army (APP_ORIGIN, el dominio registrado
 * en sus consolas) y la persona acaba en beta con la sesión ya iniciada.
 * Sin la variable, cookies de un solo dominio, como siempre.
 */
export function cookieDomain(): { domain?: string } {
  const d = process.env.COOKIE_DOMAIN?.trim()
  return d ? { domain: d } : {}
}
