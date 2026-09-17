/**
 * Puntuación de las calls (Cabal Score). Sin red ni base de datos: lo usan el
 * servidor (ranking, perfil) y el navegador (textos de ayuda).
 *
 * Cada call suma puntos según hasta dónde llegó el token después de publicarla
 * (su pico en X). Sumar niveles en vez de las X directas evita que una sola
 * call con suerte a 50X gane el ranking a quien acierta de forma constante.
 */

/** Desde este pico una call cuenta como acierto. */
export const WIN_MULTIPLE = 1.5

/** Una call que no llegó a acierto y cayó por debajo de esto resta puntos. */
export const LOSS_MULTIPLE = 0.5

export const SCORE_TIERS: { min: number; points: number; label: string }[] = [
  { min: 10, points: 10, label: '10X o más' },
  { min: 5, points: 6, label: '5X – 10X' },
  { min: 2, points: 3, label: '2X – 5X' },
  { min: 1.5, points: 1, label: '1.5X – 2X' },
]

export const LOSS_POINTS = -2

export function isWin(peak: number | null | undefined): boolean {
  return peak != null && peak >= WIN_MULTIPLE
}

/** Puntos que aporta una call con resultado. Sin dato de pico, no suma ni resta. */
export function callPoints(peak: number | null | undefined, current: number | null | undefined): number {
  if (peak == null) return 0
  for (const tier of SCORE_TIERS) if (peak >= tier.min) return tier.points
  return current != null && current < LOSS_MULTIPLE ? LOSS_POINTS : 0
}

export type CallPeriod = '24h' | '7d' | '30d' | 'all'

export const CALL_PERIODS: { key: CallPeriod; label: string }[] = [
  { key: '24h', label: '24 h' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'all', label: 'Todo' },
]

export function parsePeriod(value: string | null | undefined): CallPeriod {
  return value === '24h' || value === '7d' || value === '30d' ? value : 'all'
}

/** Inicio del periodo (calls publicadas desde entonces), o null para todo. */
export function periodStart(period: CallPeriod, now = Date.now()): Date | null {
  const hours = period === '24h' ? 24 : period === '7d' ? 24 * 7 : period === '30d' ? 24 * 30 : 0
  return hours ? new Date(now - hours * 3600_000) : null
}

export type CallSummary = {
  score: number
  /** Calls con resultado (las que aún no tienen dato no cuentan). */
  calls: number
  wins: number
  winRate: number
  bestMultiple: number | null
  avgPeak: number | null
}

export function summarizeCalls(rows: { peakMultiple: number | null; currentMultiple: number | null }[]): CallSummary {
  let score = 0
  let calls = 0
  let wins = 0
  let best: number | null = null
  let peakSum = 0
  for (const r of rows) {
    if (r.peakMultiple == null) continue
    calls++
    score += callPoints(r.peakMultiple, r.currentMultiple)
    if (isWin(r.peakMultiple)) wins++
    peakSum += r.peakMultiple
    if (best === null || r.peakMultiple > best) best = r.peakMultiple
  }
  return {
    score,
    calls,
    wins,
    winRate: calls ? Math.round((wins / calls) * 100) : 0,
    bestMultiple: best,
    avgPeak: calls ? peakSum / calls : null,
  }
}

/** 3.456 → "3.46X", 12.3 → "12.3X", 250 → "250X" */
export function fmtMultiple(x: number | null | undefined): string {
  if (x == null) return '—'
  if (x >= 100) return `${Math.round(x)}X`
  if (x >= 10) return `${x.toFixed(1)}X`
  return `${x.toFixed(2)}X`
}
