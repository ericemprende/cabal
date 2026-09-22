/**
 * Donaciones voluntarias: importes, conversión a puntos y tipos que viajan a la
 * interfaz.
 *
 * Módulo puro a propósito (sin Prisma ni `siteUrl`): lo importa el diálogo de
 * donar, que es un componente de cliente y necesita la cuenta de puntos para
 * pintar el "+250 puntos" mientras la persona elige el importe. Todo lo que
 * toca la base de datos o compone URLs vive en `donate-server.ts`.
 */

/** Importes sugeridos, en dólares. El campo libre admite cualquier otro. */
export const DONATE_PRESETS = [5, 10, 25, 50, 100] as const

/**
 * Monedas que se eligen aquí, antes de salir a la pasarela. La primera es la de
 * por defecto, y es Solana a propósito: NOWPayments tiene un mínimo por moneda,
 * y en SOL se paga desde céntimos mientras que en USDT sobre Tron la comisión
 * lo sube a once dólares — con esa de por defecto, donar $5 era imposible.
 *
 * `code` es el ticker de NOWPayments. El último, vacío, es la salida a la
 * pantalla de siempre de la pasarela, donde están las +300 monedas.
 */
export const DONATE_CURRENCIES = [
  { code: 'sol', label: 'SOL', hint: 'Solana · desde céntimos' },
  { code: 'usdtsol', label: 'USDT', hint: 'en Solana' },
  { code: 'btc', label: 'BTC', hint: 'Bitcoin' },
  { code: 'eth', label: 'ETH', hint: 'Ethereum' },
  { code: 'usdttrc20', label: 'USDT', hint: 'en Tron · mínimo alto' },
  { code: '', label: 'Otra', hint: '+300 monedas' },
] as const

/** La preseleccionada: la de mínimo más bajo. */
export const DONATE_DEFAULT_CURRENCY = 'sol'

/**
 * Ticker que entra por la API, saneado: uno de la lista, o '' para elegir en la
 * pasarela. Cualquier otra cosa (o nada, si el navegador trae la versión
 * anterior del diálogo) cae en Solana, que es el default.
 */
export function normalizeDonationCurrency(raw: unknown): string {
  if (raw === '' || raw === null) return ''
  const code = String(raw ?? '').trim().toLowerCase()
  return DONATE_CURRENCIES.some((c) => c.code === code && c.code) ? code : DONATE_DEFAULT_CURRENCY
}

/** Mínimo de la factura: por debajo, la comisión de red se come la donación. */
export const DONATE_MIN_USD = 1
/** Techo de una sola factura. Para más, se dona varias veces o se habla con el equipo. */
export const DONATE_MAX_USD = 10_000

/**
 * Puntos por cada dólar donado. Es el default de la Setting
 * `points_per_usd_donated`, editable desde el panel admin: donar $10 da 100
 * puntos, casi cuatro tesis publicadas.
 */
export const DONATE_POINTS_PER_USD = 10

/** Puntos por publicar la tarjeta de la donación en X (una vez por donación). */
export const DONATE_SHARE_BONUS = 15

/** Motivos tal y como se guardan en PointEvent.reason. */
export type DonateReason = 'donation' | 'share_donation'

/**
 * Puntos que corresponden a un importe. Se redondea hacia abajo: nunca se
 * regalan puntos que no se pagaron, y así $2.5 con la regla en 10 da 25.
 */
export function donationPoints(amountUsd: number, perUsd: number = DONATE_POINTS_PER_USD): number {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return 0
  return Math.max(0, Math.floor(amountUsd * Math.max(0, perUsd)))
}

/**
 * Importe que entra por la API, saneado: número con dos decimales dentro de los
 * límites, o null si no vale (texto, negativo, fuera de rango). Devolver null y
 * no un valor por defecto es deliberado: cobrar un importe que la persona no
 * escribió sería peor que rechazar la petición.
 */
export function normalizeDonationAmount(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const usd = Math.round(n * 100) / 100
  if (usd < DONATE_MIN_USD || usd > DONATE_MAX_USD) return null
  return usd
}

/** $25 · $7.50 — sin decimales cuando son cero, que es el caso normal. */
export function fmtUsd(amountUsd: number): string {
  return `$${Number.isInteger(amountUsd) ? amountUsd : amountUsd.toFixed(2)}`
}

/** El post de la donación en un idioma concreto (mismo molde que la campaña de X). */
export type DonateShareVariant = {
  text: string
  url: string
  intent: string
  card: string
}

/**
 * Estado de una donación para la pantalla de gracias. `status` es el del pago
 * en NOWPayments (waiting, confirming, finished…): en cripto la confirmación
 * tarda minutos, así que la interfaz enseña la tarjeta enseguida y los puntos
 * cuando la red confirma.
 */
export type DonationDTO = {
  id: string
  amountUsd: number
  status: string
  /** El pago ya está confirmado y los puntos están abonados. */
  confirmed: boolean
  /** Puntos de la donación: los abonados si está confirmada, los previstos si no. */
  points: number
  /** Bonus por compartir la tarjeta, y si ya se cobró. */
  shareBonus: number
  shared: boolean
  /** @usuario de quien donó, para la tarjeta. */
  handle: string
  locale: 'es' | 'en'
  share: Record<'es' | 'en', DonateShareVariant>
  /** Factura del proveedor, por si quedó a medias y quiere retomarla. */
  invoiceUrl: string | null
}

/** Lo que el diálogo de donar necesita para pintarse. */
export type DonateConfigDTO = {
  /** Hay claves de NOWPayments para emitir facturas nuestras (y por tanto dar puntos). */
  invoices: boolean
  /** Sesión abierta: sin cuenta no hay a quién abonarle los puntos. */
  signedIn: boolean
  presets: number[]
  minUsd: number
  maxUsd: number
  pointsPerUsd: number
  shareBonus: number
  /** Última donación con algo pendiente (confirmarse o compartir), si la hay. */
  last: DonationDTO | null
}
