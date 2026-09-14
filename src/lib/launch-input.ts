import { NETWORKS } from '@/lib/cabal'

/**
 * Validación de los datos de un launch, compartida por la creación
 * (POST /api/launches) y la edición (PATCH /api/launches/[id]). Vivir en un solo
 * sitio garantiza que editar no permita guardar nada que crear rechazaría.
 */

/** Campos del launch que puede fijar quien lo publica, ya validados. */
export type LaunchInput = {
  name: string
  ticker: string | null
  emoji: string
  image: string | null
  banner: string | null
  isPrivate: boolean
  submitterRole: 'dev' | 'community'
  contract: string | null
  devWallet: string | null
  launchpad: string | null
  network: string
  launchAt: Date
  /** false = quien sube el proyecto no tiene la fecha confirmada (es un estimado). */
  dateConfirmed: boolean
  description: string
  website: string | null
  twitter: string | null
  telegram: string | null
  isLive: boolean
  liveUrl: string | null
}

export type ParseResult = { ok: true; data: LaunchInput } | { ok: false; error: string }

/** El frontend envía los booleanos como texto ("true"/"false"). */
const bool = (v: unknown) => v === true || v === 'true'

/** Solo imágenes propias o https (evita javascript:, http plano, data:…). */
const safeUrl = (v: unknown) =>
  typeof v === 'string' && (v.startsWith('/uploads/') || v.startsWith('/seed/') || v.startsWith('https://'))
    ? v.slice(0, 500)
    : null

/** Enlaces opcionales: vacío pasa a null en vez de guardar una cadena vacía. */
const optional = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Dirección de Solana o Tron (base58) o EVM (0x…): las redes que soporta Cabal. */
const WALLET_RE = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/
/** Nombre de launchpad: libre (hay decenas), pero sin símbolos raros. */
const LAUNCHPAD_RE = /^[\p{L}\p{N} ._-]{2,40}$/u

export function parseLaunchInput(body: Record<string, unknown>): ParseResult {
  const { name, ticker, emoji, network, launchAt, description, website, twitter, telegram } = body
  const { image, banner, isPrivate, submitterRole, contract, isLive, liveUrl, devWallet, launchpad } = body
  const { dateConfirmed } = body

  if (!name || !network || !launchAt) {
    return { ok: false, error: 'Faltan campos requeridos (nombre, red y fecha)' }
  }
  const when = new Date(String(launchAt))
  if (isNaN(when.getTime())) return { ok: false, error: 'Fecha de lanzamiento inválida' }

  // El ticker es opcional: se puede anunciar un launch sin revelarlo (modo privado)
  const cleanTicker = typeof ticker === 'string' && ticker.trim() ? ticker.trim().slice(0, 12).toUpperCase() : null
  const priv = bool(isPrivate)
  if (!priv && !cleanTicker) {
    return { ok: false, error: 'Ingresa el ticker o marca el lanzamiento como privado' }
  }

  const cleanContract =
    typeof contract === 'string' && /^[a-zA-Z0-9:_-]{2,80}$/.test(contract.trim()) ? contract.trim() : null

  // Datos premium (opcionales). Mejor rechazar que guardar a medias: una wallet
  // mal copiada que se vende como dato de pago es peor que no tenerla.
  const cleanWallet = optional(devWallet, 80)
  if (cleanWallet && !WALLET_RE.test(cleanWallet)) {
    return { ok: false, error: 'La wallet del dev no parece una dirección válida de Solana, EVM o Tron' }
  }
  const cleanLaunchpad = optional(launchpad, 40)
  if (cleanLaunchpad && !LAUNCHPAD_RE.test(cleanLaunchpad)) {
    return { ok: false, error: 'El launchpad solo admite letras, números, espacios y . _ -' }
  }

  // Streaming en vivo: el creador puede marcar que se emitirá en vivo y pegar el link del stream
  const live = bool(isLive)

  return {
    ok: true,
    data: {
      name: String(name).slice(0, 60),
      ticker: cleanTicker,
      emoji: typeof emoji === 'string' && emoji ? emoji.slice(0, 8) : '🚀',
      image: safeUrl(image),
      banner: safeUrl(banner),
      isPrivate: priv,
      // ¿Quién publica? dev = el propio dev postula su proyecto | community = alguien que encontró la info
      submitterRole: submitterRole === 'dev' ? 'dev' : 'community',
      contract: cleanContract,
      devWallet: cleanWallet,
      launchpad: cleanLaunchpad,
      // La red debe ser una de las soportadas; si llega algo inválido cae a Solana
      network: typeof network === 'string' && network in NETWORKS ? network : 'solana',
      launchAt: when,
      // Sin dato explícito se asume confirmada (así se comportaba antes de este campo)
      dateConfirmed: dateConfirmed === undefined ? true : bool(dateConfirmed),
      description: String(description || '').slice(0, 800),
      website: optional(website),
      twitter: optional(twitter),
      telegram: optional(telegram),
      isLive: live,
      liveUrl: live ? safeUrl(liveUrl) : null,
    },
  }
}
