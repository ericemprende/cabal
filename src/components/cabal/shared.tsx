'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Flame,
  Gem,
  GraduationCap,
  Globe2,
  Heart,
  Lock,
  Rocket,
  ShieldCheck,
  Timer,
  XCircle,
  Zap,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { BadgeDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { displayImageUrl } from '@/lib/remote-image'
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

// ---------- Zona horaria del selector de fecha ----------
// Ej: "Bogotá · UTC-5" y, si hay hora elegida, "16:00 (local) · 21:00 UTC".
// Evita confusiones: datetime-local SIEMPRE se interpreta en la hora del dispositivo.
export type TzInfo = { city: string; offsetLabel: string }

export function timezoneInfo(): TzInfo {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
    // "GMT-5" / "GMT+2" / "GMT" → "UTC-5" / "UTC+2" / "UTC±0"
    const parts = new Intl.DateTimeFormat('en', { timeZoneName: 'shortOffset' }).formatToParts(new Date())
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
    const offsetLabel = raw === 'GMT' ? 'UTC+0' : raw.replace('GMT', 'UTC')
    return { city, offsetLabel }
  } catch {
    return { city: 'UTC', offsetLabel: 'UTC+0' }
  }
}

export function TimezoneHint({
  value,
  className,
  compact,
}: {
  /** Valor del input datetime-local (ej: "2026-09-10T16:00") */
  value?: string
  className?: string
  compact?: boolean
}) {
  const [tz, setTz] = useState<TzInfo | null>(null)
  useEffect(() => {
    // async: evita cascada de renders y mismatch de hidratación SSR/cliente
    const t = setTimeout(() => setTz(timezoneInfo()), 0)
    return () => clearTimeout(t)
  }, [])

  const local = value ? new Date(value) : null
  const valid = local && !Number.isNaN(local.getTime())

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-relaxed text-muted-foreground',
        className
      )}
    >
      <Globe2 className="h-3 w-3 shrink-0 text-primary/60" aria-hidden />
      <span>
        {tz ? (
          <>
            Hora de <span className="font-semibold text-zinc-300">{tz.city}</span> ({tz.offsetLabel})
          </>
        ) : (
          'Detectando zona horaria…'
        )}
      </span>
      {valid && (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 rounded bg-white/5 px-1.5 py-px font-medium text-zinc-300">
          <span className="tabular-nums">
            {local!.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} local
          </span>
          <span aria-hidden className="text-zinc-600">·</span>
          <span className="tabular-nums">
            {local!.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })} UTC
          </span>
        </span>
      )}
      {!compact && (
        <span className="basis-full">
          La hora elegida es la de tu dispositivo; cada usuario la ve convertida a su zona.
        </span>
      )}
    </p>
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
  src,
  size = 'md',
  verified,
  premium,
  online,
  className,
  ring = true,
}: {
  name?: string | null
  handle?: string | null
  /** URL de foto de perfil (https://, /uploads/). Si hay, se muestra la foto en vez de las iniciales. */
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  verified?: boolean
  /** Plan Premium activo: la coronita, arriba a la derecha. */
  premium?: boolean
  /** Puntico verde: el usuario tiene el chat en vivo abierto ahora mismo (ver useIsOnline). */
  online?: boolean
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
  const [imgOk, setImgOk] = useState(true)
  // Solo es imagen si es una URL real (https, /uploads/, /seed/);
  // los emojis (avatar por defecto) se muestran como texto, no como <img>.
  const isUrl =
    !!src && (/^https:\/\/\S+$/i.test(src) || src.startsWith('/uploads/') || src.startsWith('/seed/'))
  const showImg = isUrl && imgOk
  return (
    <div className="relative shrink-0">
      {showImg ? (
        <div className={cn('relative overflow-hidden rounded-full', ring && 'ring-1 ring-white/10', dims, className)}>
          <Image
            src={src!}
            alt={`Foto de ${name ?? handle ?? 'usuario'}`}
            fill
            sizes="64px"
            className="object-cover"
            unoptimized
            onError={() => setImgOk(false)}
          />
        </div>
      ) : (
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
      )}
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
      {premium && (
        <span
          className="absolute -top-1.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#0a0b08]"
          title="Premium"
        >
          <Crown className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Premium" />
        </span>
      )}
      {online && (
        <span
          className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0b08] bg-emerald-400"
          title="Conectado ahora"
          aria-label="Conectado ahora"
        />
      )}
    </div>
  )
}

// ---------- Pill "PRO" junto al nombre (ver también el prop `premium` de UserAvatar) ----------
export function PremiumPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300',
        className
      )}
    >
      <Crown className="h-3 w-3 fill-amber-300" aria-hidden /> Pro
    </span>
  )
}

// ---------- Emblemas del perfil (fundador, actividad…) ----------
const BADGE_ICONS: Record<string, typeof Gem> = {
  gem: Gem,
  'shield-check': ShieldCheck,
  flame: Flame,
  rocket: Rocket,
  'graduation-cap': GraduationCap,
  heart: Heart,
  zap: Zap,
}

export function BadgesRow({ badges, className }: { badges: BadgeDTO[]; className?: string }) {
  if (badges.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {badges.map((b) => {
        const Icon = BADGE_ICONS[b.icon] ?? Gem
        return (
          <Tooltip key={b.id}>
            <TooltipTrigger asChild>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#8FA83F]/30 bg-[#8FA83F]/10 text-primary transition-colors hover:border-[#8FA83F]/60"
                aria-label={`${b.label}: ${b.description}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-center">
              <p className="font-bold">{b.label}</p>
              <p className="font-normal opacity-90">{b.description}</p>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

// ---------- Dato premium bloqueado: valor borroso + botón para desbloquear ----------
// El launch SÍ tiene el dato (por eso está en lockedFields), pero no lo ve
// quien mira. Enseñar un valor falso desenfocado en vez de ocultar la fila del
// todo es lo que hace evidente que hay algo detrás, y por qué merece la pena pagar.
export function PremiumLockedRow({
  icon,
  label,
  fakeValue,
  onUnlock,
  className,
}: {
  icon: React.ReactNode
  label: string
  /** Texto de relleno con la forma del dato real (largo similar), nunca el dato en sí. */
  fakeValue: string
  onUnlock: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onUnlock}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-left transition-colors hover:border-amber-400/40 hover:bg-amber-400/[0.07]',
        className
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-amber-400/25 bg-amber-400/10 text-amber-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="block select-none truncate font-mono text-[13px] text-foreground/70 blur-[5px]" aria-hidden>
          {fakeValue}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-[#171200] transition-colors group-hover:bg-amber-300">
        <Lock className="h-3 w-3" aria-hidden /> Desbloquear
      </span>
    </button>
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
  // Las de IPFS pasan por la copia del servidor (ver lib/remote-image)
  const url = displayImageUrl(src)
  // Si la imagen no carga se enseña la inicial, nunca el icono de imagen rota.
  // Se recuerda qué URL falló para que al cambiar de token se vuelva a probar.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(url) && failedUrl !== url
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden border border-white/8 bg-white/4 font-machina font-bold text-zinc-400',
        dims,
        className
      )}
      aria-hidden
    >
      {showImage ? (
        <Image
          src={url as string}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
          unoptimized
          onError={() => setFailedUrl(url as string)}
        />
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

// ---------- Network badge monocromático (logo de la red + código corto) ----------
export function NetworkBadge({ network, className }: { network: string; className?: string }) {
  const meta = networkMeta(network)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300',
        className
      )}
    >
      <NetworkIcon network={network} />
      {meta.short}
    </span>
  )
}

// ---------- Logos vectoriales de las redes (formas simplificadas) ----------
export function NetworkIcon({ network, className }: { network: string; className?: string }) {
  const cls = cn('h-3.5 w-3.5 shrink-0', className)
  switch (network) {
    case 'solana':
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <defs>
            <linearGradient id="sol-g" x1="2" y1="13" x2="14" y2="3" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#14F195" />
              <stop offset="1" stopColor="#9945FF" />
            </linearGradient>
          </defs>
          <g fill="url(#sol-g)">
            <path d="M4.1 2.9h8.9l-1.9 2.5H2.2Z" />
            <path d="M2.9 6.8h9l1.9 2.5h-8.9Z" />
            <path d="M4.1 10.6h8.9l-1.9 2.5H2.2Z" />
          </g>
        </svg>
      )
    case 'bsc':
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <g fill="#F0B90B">
            <path d="m8 1.6 2 2-2 2-2-2z" />
            <path d="m3.6 6 2 2-2 2-2-2z" />
            <path d="m12.4 6 2 2-2 2-2-2z" />
            <path d="m8 6 2 2-2 2-2-2z" />
            <path d="m8 10.4 2 2-2 2-2-2z" />
          </g>
        </svg>
      )
    case 'base':
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <path
            fill="#0052FF"
            d="M8 1.6A6.4 6.4 0 1 0 8 14.4 6.4 6.4 0 0 0 8 1.6Zm-5 5.5h5.6v1.8H3Z"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
      )
    case 'ethereum':
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <path fill="#8A92B2" d="M8 1.6v4.9l4.2 1.9z" />
          <path fill="#62688F" d="M8 1.6 3.8 8.4 8 6.5z" />
          <path fill="#8A92B2" d="M8 9.1v5.3l4.2-5.8z" />
          <path fill="#62688F" d="M8 14.4V9.1L3.8 8.6z" />
          <path fill="#454A75" d="m8 8.4 4.2-2.4L8 8.1z" opacity=".9" />
        </svg>
      )
    case 'tron':
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <path fill="#EB0029" fillRule="evenodd" clipRule="evenodd" d="M2.4 2.2 14 5.6 7.3 14.4Zm2.4 2.1 3.2 7.4L11.2 6Z" />
        </svg>
      )
    case 'robinhood':
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <circle cx="8" cy="8" r="6.6" fill="#DFFF3F" />
          <path
            fill="#171A06"
            d="M5 11.6c0-3.9 2.5-6.6 6-7.1-.1 4.1-2.4 6.7-5.4 7.2L5 12.9Z"
          />
          <path stroke="#171A06" strokeWidth=".8" strokeLinecap="round" d="M4.6 13.2 5.6 11.7" />
        </svg>
      )
    case 'arc':
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <circle cx="8" cy="8" r="6.6" fill="#3D8BFF" />
          <path stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" d="M4.6 11.2a3.6 3.6 0 0 1 6.8 0" />
        </svg>
      )
    default: {
      const meta = networkMeta(network)
      return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', cls.includes('h-3.5') && 'h-2 w-2')} style={{ background: meta.dot }} />
    }
  }
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
    // La píldora vive en un span interno con tamaño fijo: así el className del
    // padre (p. ej. text-[15px] del ticker) nunca la agranda ni rompe el layout.
    return (
      <span
        className={cn('inline-flex shrink-0 items-center', className)}
        title="Ticker reservado · se revela en el lanzamiento"
      >
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-300/8 px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-wide text-amber-300/90">
          <Lock className="h-2.5 w-2.5" aria-hidden />
          Privado
        </span>
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

/** Fecha aún no confirmada: badge chiquito para poner junto a la fecha o el countdown. */
export function EstimatedDateBadge({ className }: { className?: string }) {
  return (
    <span
      title="Quien subió el proyecto todavía no tiene la fecha confirmada"
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-amber-300/40 bg-amber-300/10 px-1 py-px text-[9px] font-black uppercase tracking-wide text-amber-300',
        className
      )}
    >
      Estimada
    </span>
  )
}

export function CountdownPill({
  target,
  size = 'md',
  className,
  compact,
  estimated,
}: {
  target: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  /** Cuenta atrás corta para tarjetas angostas (con min+seg si queda <24h). */
  compact?: boolean
  /** La fecha es un estimado sin confirmar: antepone "~" y lo aclara en el title. */
  estimated?: boolean
}) {
  const c = useCountdown(target)
  // Compacto: cuenta atrás corta para tarjetas — incluye min+seg cuando queda <24h
  const text = compact ? c.compactText : c.text
  const cls =
    size === 'xs'
      ? 'gap-1 px-1 py-px text-[10px]'
      : size === 'sm'
        ? 'px-1.5 py-0.5 text-[11px]'
        : size === 'lg'
          ? 'px-3 py-1.5 text-base'
          : 'px-2 py-1 text-xs'
  const dotCls = size === 'xs' ? 'h-1 w-1' : 'h-1.5 w-1.5'
  const iconCls = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'
  // Rojo: en vivo o a punto de lanzar (<45 min) · Ámbar: pocas horas (<6 h) · Oliva: con tiempo
  const urgent = c.totalMs < 45 * 60_000
  const soon = c.totalMs < 6 * 3600_000
  if (c.live)
    return (
      <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-[#ff4d5e]/50 bg-[#ff4d5e]/12 font-bold uppercase text-[#ff6b7a]', cls, className)}>
        <span className={cn('live-dot-red shrink-0 rounded-full bg-[#ff4d5e]', dotCls)} />
        En vivo
      </span>
    )
  if (c.ended)
    return (
      <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-400', cls, className)}>
        Finalizado
      </span>
    )
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border font-mono font-bold tabular-nums',
        urgent
          ? 'border-[#ff4d5e]/50 bg-[#ff4d5e]/10 text-[#ff6b7a]'
          : soon
            ? 'border-amber-300/40 bg-amber-300/10 text-amber-300'
            : 'border-[#8FA83F]/30 bg-[#8FA83F]/8 text-primary',
        cls,
        className
      )}
      title={
        estimated
          ? 'Fecha estimada, todavía sin confirmar'
          : urgent
            ? 'Lanzamiento inminente'
            : 'Tiempo para el lanzamiento'
      }
    >
      {urgent ? (
        <span className={cn('live-dot-red shrink-0 rounded-full bg-[#ff4d5e]', dotCls)} aria-hidden />
      ) : (
        <Timer className={cn('shrink-0', iconCls)} aria-hidden />
      )}
      {estimated && '~'}
      {text}
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
