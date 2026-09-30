/**
 * ¿Se está viendo Cabal dentro de la app nativa? La app de Capacitor (carpeta
 * mobile/) añade "CabalApp-iOS" o "CabalApp-Android" al User-Agent, así que
 * sirve igual en el navegador y en el servidor.
 *
 * Para qué: la App Store no permite vender bienes digitales (Premium,
 * munición) fuera de In-App Purchase ni recibir donaciones si no eres una ONG
 * (normas 3.1.1 y 3.2.2). En la app de iOS esas compras se ocultan y el
 * servidor las rechaza. Android (Play y Solana dApp Store) va como TWA, sin
 * esta marca, y no cambia nada.
 */
export const IOS_APP_UA = 'CabalApp-iOS'
export const ANDROID_APP_UA = 'CabalApp-Android'

export function isIosAppUA(ua: string | null | undefined): boolean {
  return Boolean(ua && ua.includes(IOS_APP_UA))
}

/** En el navegador: ¿estamos dentro de la app de iOS? */
export function isIosApp(): boolean {
  return typeof navigator !== 'undefined' && isIosAppUA(navigator.userAgent)
}

/** Compras de bienes digitales y donaciones permitidas en este cliente. */
export function purchasesAllowed(): boolean {
  return !isIosApp()
}

/** En el servidor: respuesta 403 si la petición viene de la app de iOS. */
export function blockIosAppPurchase(req: Request): Response | null {
  if (!isIosAppUA(req.headers.get('user-agent'))) return null
  return Response.json({ error: 'Las compras no están disponibles en la app de iOS.' }, { status: 403 })
}
