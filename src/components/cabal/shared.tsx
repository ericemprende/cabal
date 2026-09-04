'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Check, CheckCircle2, Copy, Lock, Timer, XCircle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { countdownParts, networkMeta, safetyCheck, shortWallet } from '@/lib/cabal'

// ---------- Wordmark (sin logo: solo la fuente en mayúscula) ----------
export function CabalWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base'
  return (
    <span
      className={cn(
        'font-machina font-bold uppercase tracking-[0.08em] text-foreground select-none',
        text
      )}
    >
      Cabal
    </span>
  )
}

// ---------- Initials del usuario ----------
function initialOf(name?: string | null): string {
  const n = (name ?? '').trim()
  if (!n) return '?'
  const parts = n.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return n[0].toUpperCase()
}

// ---------- Avatar monocromático (iniciales, sin emoji) ----------
const AVATAR_TONES = [
  'from-[#20231a] to-[#12140e] text-[#c3cbaa]',
  'from-[#1b1e22] to-[#101214] text-[#b7c2c9]',
  'from-[#221f18] to-[#131109] text-[#ccc2a8]',
  'from-[#181f1c] to-[#0e1210] text-[#adc2b8]',
  'from-[#232019] to-[#14110a] text-[#c9bfa4]',
]

export function UserAvatar({
  name,
  handle,
  size = 'md',
  verified,
  className,
  ring = true,
}: {
  name?: string | null
  handle?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  verified?: boolean
  className?: string
  ring?: boolean
}) {
  const tone = AVATAR_TONES[((name ?? handle ?? '?').codePointAt(0) ?? 0) % AVATAR_TONES.length]
  const dims =
    size === 'xs'
      ? 'h-6 w-6 text-[9px]'
      : size === 'sm'
        ? 'h-8 w-8 text-[11px]'
        : size === 'md'
          ? 'h-10 w-10 text-[13px]'
          : size === 'lg'
            ? 'h-12 w-12 text-sm'
            : 'h-16 w-16 text-lg'
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br font-machina font-bold',
          tone,
          ring && 'ring-1 ring-white/10',
          dims,
          className
        )}
        aria-hidden
      >
        {initialOf(name ?? handle)}
      </div>
      {verified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0a0b08]"
          title="Wallet verificada"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-label="Verificado">
            <circle cx="8" cy="8" r="8" fill="#8FA83F" />
            <path d="M4.5 8.2 7 10.6 11.5 5.6" stroke="#101403" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </div>
  )
}

// ---------- Glyph de token/launch (imagen si hay, iniciales monocromas si no) ----------
export function TokenGlyph({
  src,
  ticker,
  size = 'md',
  className,
}: {
  src?: string | null
  ticker: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const dims =
    size === 'xs'
      ? 'h-6 w-6 text-[9px] rounded-md'
      : size === 'sm'
        ? 'h-8 w-8 text-[11px] rounded-md'
        : size === 'md'
          ? 'h-10 w-10 text-[13px] rounded-lg'
          : size === 'lg'
            ? 'h-12 w-12 text-sm rounded-lg'
            : 'h-16 w-16 text-lg rounded-xl'
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden border border-white/8 bg-white/4 font-machina font-bold text-zinc-400',
        dims,
        className
      )}
      aria-hidden
    >
      {src ? (
        <Image src={src} alt={ticker} fill sizes="64px" className="object-cover" unoptimized />
      ) : (
        <span>{(ticker || '?').replace(/^\$/, '')[0]?.toUpperCase()}</span>
      )}
    </div>
  )
}

// ---------- Chip de contrato (CA) con botón copiar ----------
export function CopyCA({ contract, className }: { contract: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contract)
      setCopied(true)
      toast.success('CA copiado al portapapeles')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('No se pudo copiar el CA')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={contract}
      aria-label={`Copiar contrato: ${contract}`}
      className={cn(
        'group inline-flex max-w-full items-center gap-1 rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-300 transition-colors hover:border-primary/40 hover:text-primary',
        copied && 'border-primary/50 text-primary',
        className
      )}
    >
      <span className="truncate">{shortWallet(contract)}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-55 transition-opacity group-hover:opacity-100" aria-hidden />
      )}
    </button>
  )
}

// ---------- Network badge monocromático (identidad solo en el punto de color) ----------
export function NetworkBadge({ network, className }: { network: string; className?: string }) {
  const meta = networkMeta(network)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300',
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.short}
    </span>
  )
}

// ---------- Ticker label (con soporte para launches privados) ----------
export function TickerLabel({
  ticker,
  isPrivate,
  className,
}: {
  ticker?: string | null
  isPrivate?: boolean
  className?: string
}) {
  if (isPrivate || !ticker) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-300/8 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300/90',
          className
        )}
        title="Ticker reservado · se revela en el lanzamiento"
      >
        <Lock className="h-2.5 w-2.5" aria-hidden />
        Privado
      </span>
    )
  }
  return <span className={className}>${ticker}</span>
}

// ---------- Points pill ----------
export function PointsPill({ points, className }: { points: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[#8FA83F]/25 bg-[#8FA83F]/8 px-2 py-0.5 text-[11px] font-semibold text-primary',
        className
      )}
      title="Puntos Cabal"
    >
      <Zap className="h-3 w-3" aria-hidden />
      {points.toLocaleString('es')}
    </span>
  )
}

// ---------- Post kind badge ----------
export function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    thesis: { label: 'Tesis', cls: 'bg-[#8FA83F]/12 text-primary border-[#8FA83F]/30' },
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
  // Rojo: en vivo o a punto de lanzar (<45 min) · Ámbar: pocas horas (<6 h) · Oliva: con tiempo
  const urgent = c.totalMs < 45 * 60_000
  const soon = c.totalMs < 6 * 3600_000
  if (c.live)
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-md border border-[#ff4d5e]/50 bg-[#ff4d5e]/12 font-bold uppercase text-[#ff6b7a]', cls, className)}>
        <span className="live-dot-red h-1.5 w-1.5 rounded-full bg-[#ff4d5e]" />
        En vivo
      </span>
    )
  if (c.ended)
    return (
      <span className={cn('inline-flex items-center rounded-md border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-400', cls, className)}>
        Finalizado
      </span>
    )
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-mono font-bold tabular-nums',
        urgent
          ? 'border-[#ff4d5e]/50 bg-[#ff4d5e]/10 text-[#ff6b7a]'
          : soon
            ? 'border-amber-300/40 bg-amber-300/10 text-amber-300'
            : 'border-[#8FA83F]/30 bg-[#8FA83F]/8 text-primary',
        cls,
        className
      )}
      title={urgent ? 'Lanzamiento inminente' : 'Tiempo para el lanzamiento'}
    >
      {urgent ? (
        <span className="live-dot-red h-1.5 w-1.5 rounded-full bg-[#ff4d5e]" aria-hidden />
      ) : (
        <Timer className="h-3 w-3" aria-hidden />
      )}
      {c.text}
    </span>
  )
}

// ---------- Safety checks (iconos monocromos) ----------
function CheckItem({ ok, label, showLabel, warn }: { ok: boolean; label: string; showLabel?: boolean; warn?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', ok ? 'text-primary' : warn ? 'text-amber-300/90' : 'text-zinc-500')}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
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
      <CheckItem ok={top10Pct <= 20} label={`Top10 ${top10Pct}%`} showLabel={!compact} warn />
      {compact && (
        <span className={cn('inline-flex items-center gap-1 text-[11px]', top10Pct <= 20 ? 'text-primary' : 'text-amber-300/90')}>
          {top10Pct}%
        </span>
      )}
      <span
        className={cn(
          'ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
          s.level === 'safe' && 'bg-[#8FA83F]/12 text-primary',
          s.level === 'mid' && 'bg-amber-300/12 text-amber-300',
          s.level === 'risky' && 'bg-[#ff4d5e]/12 text-[#ff8080]'
        )}
      >
        {s.label} · {s.score}
      </span>
    </div>
  )
}
