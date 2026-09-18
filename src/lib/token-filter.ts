/**
 * Filtro por token de un chat vinculado. Hay comunidades que solo quieren oír
 * hablar de su token: con el filtro puesto, al chat solo le llegan las calls,
 * tesis, lanzamientos y recordatorios de los tokens de la lista.
 *
 * Cada entrada es un contrato (tal cual, porque los de Solana distinguen
 * mayúsculas) o un ticker con "$" delante, guardado en mayúsculas. Lista vacía
 * = sin filtro. Se usa en el servidor y en la web, así que no toca la base de datos.
 */

export const MAX_TOKEN_FILTER = 10

const CONTRACT = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/
const TICKER = /^\$?[A-Za-z0-9]{1,20}$/

/** "$lucky" → "$LUCKY"; un CA se queda igual. null si no es ni una cosa ni la otra. */
export function normalizeFilterEntry(raw: string): string | null {
  const v = raw.trim()
  if (CONTRACT.test(v)) return v
  if (TICKER.test(v)) return `$${v.replace(/^\$/, '').toUpperCase()}`
  return null
}

/** Limpia la lista que llega de la web: válidas, sin repetidas y con tope. */
export function sanitizeTokenFilter(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null
  const out: string[] = []
  for (const x of input) {
    const v = typeof x === 'string' ? normalizeFilterEntry(x) : null
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  return out.slice(0, MAX_TOKEN_FILTER)
}

/** Añade la entrada si no está y la quita si ya estaba. */
export function toggleFilterEntry(current: string[], entry: string): string[] {
  const has = current.some((c) => c.toLowerCase() === entry.toLowerCase())
  return has ? current.filter((c) => c.toLowerCase() !== entry.toLowerCase()) : [...current, entry].slice(0, MAX_TOKEN_FILTER)
}

export type FilterSubject = {
  contracts: (string | null | undefined)[]
  tickers: (string | null | undefined)[]
}

/** ¿Este aviso pasa el filtro del chat? Sin filtro pasa todo. */
export function matchesTokenFilter(filter: string[], subject: FilterSubject): boolean {
  if (filter.length === 0) return true
  const contracts = new Set(subject.contracts.filter(Boolean).map((c) => c!.toLowerCase()))
  const tickers = new Set(subject.tickers.filter(Boolean).map((t) => t!.replace(/^\$/, '').toUpperCase()))
  return filter.some((f) => (f.startsWith('$') ? tickers.has(f.slice(1)) : contracts.has(f.toLowerCase())))
}
