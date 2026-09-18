export type NetworkKey = 'solana' | 'base' | 'ethereum' | 'bsc' | 'tron' | 'robinhood' | 'arc'

export const NETWORKS: Record<
  NetworkKey,
  { label: string; short: string; dot: string }
> = {
  solana: { label: 'Solana', short: 'SOL', dot: '#9945FF' },
  base: { label: 'Base', short: 'BASE', dot: '#0052FF' },
  ethereum: { label: 'Ethereum', short: 'ETH', dot: '#8A92B2' },
  bsc: { label: 'BNB Chain', short: 'BSC', dot: '#F0B90B' },
  tron: { label: 'Tron', short: 'TRX', dot: '#FF4D5E' },
  robinhood: { label: 'Robinhood', short: 'RH', dot: '#DFFF3F' },
  arc: { label: 'Arc', short: 'ARC', dot: '#3D8BFF' },
}

export function networkMeta(key: string) {
  return NETWORKS[key as NetworkKey] ?? NETWORKS.solana
}

/**
 * Launchpads habituales de cada red, para elegirlos de un toque al publicar.
 * Es solo una ayuda: el campo admite cualquier otro.
 */
export const LAUNCHPADS: Record<NetworkKey, string[]> = {
  solana: ['pump.fun', 'LetsBonk', 'Raydium LaunchLab', 'Meteora', 'Moonshot', 'Believe'],
  base: ['Zora', 'Clanker', 'Virtuals', 'Flaunch'],
  ethereum: ['Uniswap'],
  bsc: ['Four.meme'],
  tron: ['SunPump'],
  robinhood: [],
  arc: [],
}

export function fmtMc(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function fmtPrice(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.001) return `$${n.toFixed(4)}`
  return `$${n.toFixed(7)}`
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

export function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d`
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

/** Cuánto dura "EN VIVO" tras la hora de lanzamiento. */
export const LIVE_WINDOW_MS = 2 * 3600_000
/** Tras esto el launch sale de Próximos y pasa a Finalizados. */
export const LAUNCHED_WINDOW_MS = 24 * 3600_000

export function countdownParts(target: string | Date): {
  ended: boolean
  /** Primeras 2 h tras la hora de lanzamiento. */
  live: boolean
  /** Entre 2 h y 24 h tras lanzar: "Lanzado", ya sin rojo. */
  recent: boolean
  /** Texto completo: SIEMPRE incluye minutos y segundos (tiqueta en vivo). */
  text: string
  /** Versión corta para píldoras de tarjetas (mantiene min+seg cuando queda <24h). */
  compactText: string
  totalMs: number
} {
  const t = typeof target === 'string' ? new Date(target).getTime() : target.getTime()
  const diff = t - Date.now()
  if (diff <= 0) {
    const since = -diff
    const live = since <= LIVE_WINDOW_MS
    const ended = since > LAUNCHED_WINDOW_MS
    const text = live ? 'EN VIVO' : 'LANZADO'
    return {
      ended,
      live,
      recent: !live && !ended,
      text,
      compactText: text,
      totalMs: 0,
    }
  }
  const days = Math.floor(diff / (24 * 3600_000))
  const hours = Math.floor((diff % (24 * 3600_000)) / 3600_000)
  const min = Math.floor((diff % 3600_000) / 60000)
  const sec = Math.floor((diff % 60000) / 1000)
  const ss = String(sec).padStart(2, '0')
  let text: string
  let compactText: string
  if (days > 0) {
    text = `${days}d ${hours}h ${min}m ${ss}s`
    compactText = `${days}d ${hours}h ${min}m`
  } else if (hours > 0) {
    text = `${hours}h ${String(min).padStart(2, '0')}m ${ss}s`
    compactText = text
  } else {
    text = `${min}m ${ss}s`
    compactText = text
  }
  return { ended: false, live: false, recent: false, text, compactText, totalMs: diff }
}

export function safetyCheck(l: { lpLocked: boolean; mintRevoked: boolean; top10Pct: number }): {
  score: number
  label: string
  level: 'safe' | 'mid' | 'risky'
} {
  let score = 0
  if (l.lpLocked) score += 40
  if (l.mintRevoked) score += 35
  if (l.top10Pct <= 15) score += 25
  else if (l.top10Pct <= 25) score += 15
  else score += 5
  const level = score >= 75 ? 'safe' : score >= 45 ? 'mid' : 'risky'
  const label = score >= 75 ? 'Seguro' : score >= 45 ? 'Medio' : 'Casino'
  return { score, label, level }
}

export function shortWallet(w?: string | null): string {
  if (!w) return ''
  if (w.length <= 12) return w
  return `${w.slice(0, 4)}…${w.slice(-4)}`
}

export const POST_KIND_META: Record<
  string,
  { label: string; className: string }
> = {
  thesis: { label: 'Tesis', className: 'bg-[#8FA83F]/15 text-[#8FA83F] border-[#8FA83F]/30' },
  call: { label: 'Call', className: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
  trade: { label: 'Trade', className: 'bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/25' },
  comment: { label: 'Comentario', className: 'bg-zinc-400/10 text-zinc-300 border-zinc-400/20' },
}
