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
  network: string
  launchAt: Date
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

export function parseLaunchInput(body: Record<string, unknown>): ParseResult {
  const { name, ticker, emoji, network, launchAt, description, website, twitter, telegram } = body
  const { image, banner, isPrivate, submitterRole, contract, isLive, liveUrl } = body

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
      // La red debe ser una de las soportadas; si llega algo inválido cae a Solana
      network: typeof network === 'string' && network in NETWORKS ? network : 'solana',
      launchAt: when,
      description: String(description || '').slice(0, 800),
      website: optional(website),
      twitter: optional(twitter),
      telegram: optional(telegram),
      isLive: live,
      liveUrl: live ? safeUrl(liveUrl) : null,
    },
  }
}
