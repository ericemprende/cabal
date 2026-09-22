export type NetworkKey = 'solana' | 'base' | 'ethereum' | 'bsc' | 'tron' | 'robinhood' | 'arc'

/**
 * `dot` es EL color de cada red: lo usan el puntito de las listas y el logo de
 * NetworkIcon. Antes cada uno llevaba el suyo y Tron acabó con dos rojos, uno
 * de ellos el #ff4d5e que la interfaz reserva para "lanzamiento en vivo".
 */
export const NETWORKS: Record<
  NetworkKey,
  { label: string; short: string; dot: string }
> = {
  solana: { label: 'Solana', short: 'SOL', dot: '#9945FF' },
  base: { label: 'Base', short: 'BASE', dot: '#0052FF' },
  ethereum: { label: 'Ethereum', short: 'ETH', dot: '#627EEA' },
  bsc: { label: 'BNB Chain', short: 'BSC', dot: '#F3BA2F' },
  tron: { label: 'Tron', short: 'TRX', dot: '#EB0029' },
  robinhood: { label: 'Robinhood', short: 'RH', dot: '#CCFF00' },
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
export const LIVE_WINDOW_MS = 15 * 60_000
/** Tras esto el launch sale de Próximos y pasa a Finalizados. */
export const LAUNCHED_WINDOW_MS = 30 * 60_000
/**
 * Fecha estimada que ya pasó: que llegue la hora no significa que el token haya
 * salido, así que sigue *pendiente* en Próximos hasta que se agote esta gracia
 * (o hasta que quien lo subió confirme la fecha de verdad).
 */
export const ESTIMATED_GRACE_MS = 6 * 3600_000

/**
 * En qué momento de su vida está un launch. Única fuente de verdad: la usan el
 * servidor (para el `status` del DTO) y el radar en cliente, que la recalcula
 * cada segundo para que una tarjeta salte sola de Próximos a Finalizados sin
 * esperar a un refetch.
 */
export type LaunchPhase = 'upcoming' | 'live' | 'recent' | 'pending' | 'ended'

export function launchPhase(
  launchAt: string | Date | number,
  dateConfirmed = true,
  now: number = Date.now(),
): LaunchPhase {
  const t =
    typeof launchAt === 'number'
      ? launchAt
      : typeof launchAt === 'string'
        ? new Date(launchAt).getTime()
        : launchAt.getTime()
  const since = now - t
  if (since < 0) return 'upcoming'
  if (!dateConfirmed) return since <= ESTIMATED_GRACE_MS ? 'pending' : 'ended'
  if (since <= LIVE_WINDOW_MS) return 'live'
  if (since <= LAUNCHED_WINDOW_MS) return 'recent'
  return 'ended'
}

export function countdownParts(target: string | Date, dateConfirmed = true): {
  ended: boolean
  /** Primeros 15 min tras la hora de lanzamiento. */
  live: boolean
  /** Entre 15 y 30 min tras lanzar: "Lanzado", ya sin rojo. */
  recent: boolean
  /** Pasó una fecha estimada: no ha salido nada todavía, sigue pendiente. */
  pending: boolean
  /** Texto completo: SIEMPRE incluye minutos y segundos (tiqueta en vivo). */
  text: string
  /** Versión corta para píldoras de tarjetas (mantiene min+seg cuando queda <24h). */
  compactText: string
  totalMs: number
} {
  const t = typeof target === 'string' ? new Date(target).getTime() : target.getTime()
  const diff = t - Date.now()
  if (diff <= 0) {
    const phase = launchPhase(t, dateConfirmed)
    const text = phase === 'live' ? 'EN VIVO' : phase === 'pending' ? 'PENDIENTE' : 'LANZADO'
    return {
      ended: phase === 'ended',
      live: phase === 'live',
      recent: phase === 'recent',
      pending: phase === 'pending',
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
  return { ended: false, live: false, recent: false, pending: false, text, compactText, totalMs: diff }
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
