'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { countdownParts, networkMeta, safetyCheck } from '@/lib/cabal'

// ---------- Logo ----------
export function CabalLogo({ size = 'md', withWordmark = true }: { size?: 'sm' | 'md' | 'lg'; withWordmark?: boolean }) {
  const dims = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  const text = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-[22px]' : 'text-lg'
  return (
    <div className="flex items-center gap-2 select-none">
      <svg viewBox="0 0 32 32" className={cn(dims, 'drop-shadow-[0_0_6px_rgba(0,255,136,0.6)]')} aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0b120d" />
        <path
          d="M16 4C9.4 4 4.5 9.2 4.5 15.6V24c0 1.4 1.1 2.5 2.5 2.5h18c1.4 0 2.5-1.1 2.5-2.5v-8.4C27.5 9.2 22.6 4 16 4z"
          stroke="#00ff88"
          strokeWidth="2.2"
          fill="none"
        />
        <path d="M9.5 26.5V15.9c0-3.7 2.9-6.6 6.5-6.6s6.5 2.9 6.5 6.6v10.6" stroke="#00ff88" strokeWidth="1.4" opacity="0.5" fill="none" />
        <rect x="10.6" y="15.4" width="4.2" height="2.4" rx="1.2" fill="#00ff88" />
        <rect x="17.2" y="15.4" width="4.2" height="2.4" rx="1.2" fill="#00ff88" />
      </svg>
      {withWordmark && (
        <span className={cn('font-display font-bold tracking-tight text-glow text-primary', text)}>
          cabal
        </span>
      )}
    </div>
  )
}

// ---------- Emoji avatar ----------
const AVATAR_GRADIENTS = [
  'from-[#0c2f1d] to-[#07130b] ring-[#00ff88]/35',
  'from-[#12301b] to-[#0a1410] ring-[#00ff88]/25',
  'from-[#0d2a24] to-[#081410] ring-emerald-300/25',
  'from-[#1c2f12] to-[#0e140a] ring-lime-300/25',
  'from-[#2a2412] to-[#141008] ring-amber-300/25',
]

export function EmojiAvatar({
  emoji,
  size = 'md',
  verified,
  className,
  ring = true,
}: {
  emoji: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  verified?: boolean
  className?: string
  ring?: boolean
}) {
  const gradient = AVATAR_GRADIENTS[(emoji.codePointAt(0) ?? 0) % AVATAR_GRADIENTS.length]
  const dims =
    size === 'xs'
      ? 'h-6 w-6 text-[11px]'
      : size === 'sm'
        ? 'h-8 w-8 text-sm'
        : size === 'md'
          ? 'h-10 w-10 text-lg'
          : size === 'lg'
            ? 'h-12 w-12 text-xl'
            : 'h-16 w-16 text-3xl'
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br',
          gradient,
          ring && 'ring-1',
          dims,
          className
        )}
        aria-hidden
      >
        {emoji}
      </div>
      {verified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#060a08]"
          title="Wallet verificada"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-label="Verificado">
            <circle cx="8" cy="8" r="8" fill="#00ff88" />
            <path d="M4.5 8.2 7 10.6 11.5 5.6" stroke="#04140b" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </div>
  )
}

// ---------- Network badge ----------
export function NetworkBadge({ network, className }: { network: string; className?: string }) {
  const meta = networkMeta(network)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        className
      )}
      style={{ color: meta.color, background: `${meta.color}14`, border: `1px solid ${meta.color}30` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.short}
    </span>
  )
}

// ---------- Points pill ----------
export function PointsPill({ points, className }: { points: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[#00ff88]/25 bg-[#00ff88]/8 px-2 py-0.5 text-[11px] font-semibold text-primary',
        className
      )}
      title="Puntos Cabal"
    >
      <span aria-hidden>⚡</span>
      {points.toLocaleString('es')}
    </span>
  )
}

// ---------- Post kind badge ----------
export function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    thesis: { label: 'Tesis', cls: 'bg-[#00ff88]/12 text-primary border-[#00ff88]/30' },
    call: { label: 'Call', cls: 'bg-amber-400/12 text-amber-300 border-amber-400/30' },
    trade: { label: 'Trade', cls: 'bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/25' },
    comment: { label: 'Comentario', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  }
  const meta = map[kind] ?? map.comment
  return (
    <span className={cn('rounded-md border px-1.5 py-px text-[10px] font-semibold', meta.cls)}>
      {meta.label}
    </span>
  )
}

// ---------- Countdown ----------
export function useCountdown(target: string | Date) {
  const [parts, setParts] = useState(() => countdownParts(target))
  const targetRef = useRef(target)
  useEffect(() => {
    targetRef.current = target
  }, [target])
  useEffect(() => {
    const t = setInterval(() => setParts(countdownParts(targetRef.current)), 1000)
    return () => clearInterval(t)
  }, [])
  return parts
}

export function CountdownPill({
  target,
  size = 'md',
  className,
}: {
  target: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const c = useCountdown(target)
  const cls =
    size === 'sm'
      ? 'text-[11px] px-1.5 py-0.5'
      : size === 'lg'
        ? 'text-base px-3 py-1.5'
        : 'text-xs px-2 py-1'
  if (c.live)
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-md border border-[#00ff88]/40 bg-[#00ff88]/10 font-bold uppercase text-primary', cls, className)}>
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-primary" />
        En vivo
      </span>
    )
  if (c.ended)
    return (
      <span className={cn('inline-flex items-center rounded-md border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-400', cls, className)}>
        Finalizado
      </span>
    )
  const urgent = c.totalMs < 60 * 60_000
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-mono font-bold tabular-nums',
        urgent ? 'border-amber-300/40 bg-amber-300/10 text-amber-300' : 'border-[#00ff88]/30 bg-[#00ff88]/8 text-primary',
        cls,
        className
      )}
      title="Tiempo para el lanzamiento"
    >
      ⏱ {c.text}
    </span>
  )
}

// ---------- Safety checks ----------
function CheckItem({ ok, label, showLabel }: { ok: boolean; label: string; showLabel?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', ok ? 'text-primary' : 'text-zinc-500')}>
      <span aria-hidden>{ok ? '✅' : '⚠️'}</span>
      {showLabel && <span>{label}</span>}
    </span>
  )
}

export function SafetyChecks({
  lpLocked,
  mintRevoked,
  top10Pct,
  compact,
}: {
  lpLocked: boolean
  mintRevoked: boolean
  top10Pct: number
  compact?: boolean
}) {
  const s = safetyCheck({ lpLocked, mintRevoked, top10Pct })
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <CheckItem ok={lpLocked} label="LP bloqueada" showLabel={!compact} />
      <CheckItem ok={mintRevoked} label="Mint revocado" showLabel={!compact} />
      <span className={cn('inline-flex items-center gap-1 text-[11px]', top10Pct <= 20 ? 'text-primary' : 'text-amber-300')}>
        <span aria-hidden>{top10Pct <= 20 ? '✅' : '⚠️'}</span>
        {!compact && <span>Top10 {top10Pct}%</span>}
        {compact && <span>{top10Pct}%</span>}
      </span>
      <span
        className={cn(
          'ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
          s.level === 'safe' && 'bg-[#00ff88]/12 text-primary',
          s.level === 'mid' && 'bg-amber-300/12 text-amber-300',
          s.level === 'risky' && 'bg-[#ff4d5e]/12 text-[#ff8080]'
        )}
      >
        {s.label} · {s.score}
      </span>
    </div>
  )
}
