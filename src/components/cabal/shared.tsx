'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { defaultAvatarFor } from '@/lib/default-avatar'
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
import { useT } from '@/lib/i18n/provider'
import { Chapa, type Metal } from '@/components/cabal/chapa'
import { BadgesDialog, useBadgesText } from '@/components/cabal/badges-ui'
import { SILUETAS, type Silueta } from '@/lib/siluetas'
import { displayImageUrl } from '@/lib/remote-image'
import { countdownParts, networkMeta, safetyCheck, shortWallet } from '@/lib/cabal'

// ---------- Wordmark (sin logo: solo la fuente en mayúscula) ----------
export function CabalWordmark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const h = size === 'lg' ? 'h-10' : size === 'md' ? 'h-7' : 'h-6'
  return (
    <img
      src="/cabal-wordmark.webp"
      alt="Cabal"
      width={305}
      height={128}
      draggable={false}
      className={cn('w-auto shrink-0 select-none', h, className)}
    />
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
  const t = useT()
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
            {t.shared.hourIn} <span className="font-semibold text-zinc-300">{tz.city}</span> ({tz.offsetLabel})
          </>
        ) : (
          t.shared.detectingTz
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

export function UserAvatar({
  name,
  handle,
  src,
  size = 'md',
  verified,
  official,
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
  /** Verificado oficialmente por Cabal: aro verde con destello y sello. */
  official?: boolean
  /** Plan Premium activo: la coronita, encima del avatar (fuera de la foto). */
  premium?: boolean
  /** Puntico verde: el usuario tiene el chat en vivo abierto ahora mismo (ver useIsOnline). */
  online?: boolean
  className?: string
  ring?: boolean
}) {
  const t = useT()
  // A quien no ha subido foto se le asigna un personaje del escuadrón, siempre el mismo.
  const fallback = defaultAvatarFor(handle ?? name)
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
        <div className={cn('relative overflow-hidden rounded-full', ring && !official && 'ring-1 ring-white/10', official && 'official-glow', dims, className)}>
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
            'relative overflow-hidden rounded-full',
            ring && !official && 'ring-1 ring-white/10',
            official && 'official-glow',
            dims,
            className
          )}
          style={{ backgroundColor: fallback.color }}
          aria-hidden
        >
          {/* Sin foto propia, un personaje del escuadrón sobre un color de la
              marca. Es el mismo siempre para la misma persona. */}
          <img src={fallback.image} alt="" className="h-full w-full object-cover" draggable={false} />
        </div>
      )}
      {(verified || official) && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0a0b08]"
          title={official ? t.shared.verifiedByCabal : t.shared.verifiedWallet}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-label={t.shared.verified}>
            <circle cx="8" cy="8" r="8" fill={official ? '#7fe04a' : '#8FA83F'} />
            <path d="M4.5 8.2 7 10.6 11.5 5.6" stroke="#101403" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      {premium && (
        // Encima del avatar, sin tapar la foto: la base de la corona toca el borde del círculo
        <span className="pointer-events-none absolute bottom-full left-1/2 -mb-px -translate-x-1/2" title={t.shared.premium}>
          <Crown
            className={cn(
              'fill-amber-400 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]',
              size === 'xs' || size === 'sm' ? 'h-3 w-3' : size === 'xl' ? 'h-5 w-5' : 'h-4 w-4'
            )}
            aria-label={t.shared.premium}
          />
        </span>
      )}
      {online && (
        <span
          className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0b08] bg-emerald-400"
          title={t.shared.onlineNow}
          aria-label={t.shared.onlineNow}
        />
      )}
    </div>
  )
}

// ---------- Sello de verificación oficial junto al nombre (perfil, launch o token) ----------
export function OfficialBadge({
  label = false,
  title = 'Verificado por Cabal',
  className,
}: {
  /** true = sello + texto "Verificado"; false = solo el sello. */
  label?: boolean
  title?: string
  className?: string
}) {
  const t = useT()
  const seal = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 drop-shadow-[0_0_4px_rgba(127,224,74,0.6)]" aria-hidden>
      <path
        fill="#7fe04a"
        d="M12 1.5l2.4 1.9 3-.3 1 2.9 2.7 1.4-.6 3 1.6 2.6-2.2 2.1.1 3.1-3 .7-1.6 2.6-2.9-1-2.9 1-1.6-2.6-3-.7.1-3.1-2.2-2.1 1.6-2.6-.6-3 2.7-1.4 1-2.9 3 .3z"
      />
      <path d="M7.8 12.3l2.8 2.8 5.6-6" stroke="#0d1a05" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (!label)
    return (
      <span className={cn('inline-flex shrink-0 items-center', className)} title={title} aria-label={title} role="img">
        {seal}
      </span>
    )
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-[#7fe04a]/40 bg-[#7fe04a]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#a6f27a]',
        className
      )}
      title={title}
    >
      {seal}
      Verificado
    </span>
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
      <Chapa silueta="imperial-crown" metal="oro" className="h-[18px] w-[18px]" placa /> Pro
    </span>
  )
}

// ---------- Emblemas del perfil (fundador, actividad…) ----------
// La silueta, el metal y el rango los decide lib/badges.ts: aquí solo se pintan.

export function BadgesRow({
  badges,
  next,
  max = 6,
  className,
}: {
  badges: BadgeDTO[]
  /** Objetivos siguientes (solo en el perfil propio): salen en la vitrina completa. */
  next?: BadgeDTO[]
  /** Cuántas se enseñan en fila; las demás van a la vitrina completa. */
  max?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const txt = useBadgesText()
  if (badges.length === 0 && !next?.length) return null
  const visibles = badges.slice(0, max)
  const resto = badges.length - visibles.length
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {visibles.map((b) => {
        const silueta = (b.silueta ?? b.icon) as Silueta
        if (!(silueta in SILUETAS)) return null
        return (
          <Tooltip key={b.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-[#171a13] transition-colors hover:border-[#8FA83F]/60"
                aria-label={`${b.label}: ${b.description}`}
              >
                <Chapa silueta={silueta} metal={(b.metal ?? 'acero') as Metal} className="h-[26px] w-[26px]" placa />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-center">
              <p className="font-bold">{b.label}</p>
              <p className="font-normal opacity-90">{b.description}</p>
            </TooltipContent>
          </Tooltip>
        )
      })}
      {(resto > 0 || !!next?.length) && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 items-center justify-center rounded-full border border-white/12 bg-[#171a13] px-3 text-[12px] font-bold text-muted-foreground transition-colors hover:border-[#8FA83F]/60 hover:text-foreground"
        >
          {resto > 0 ? `+${resto}` : txt.all}
        </button>
      )}
      <BadgesDialog open={open} onOpenChange={setOpen} badges={badges} next={next} />
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
  const t = useT()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contract)
      setCopied(true)
      toast.success(t.shared.caCopied)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error(t.shared.caCopyFailed)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={contract}
      aria-label={t.shared.copyContract(contract)}
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

// ---------- Logos vectoriales de las redes ----------
// Formas simplificadas dibujadas a mano, en el color de marca de cada red. El
// que no tenga caso propio cae al puntito de NETWORKS[red].dot, que es la misma
// fuente de color: así una red nunca sale con dos colores distintos.
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
          <g fill="#F3BA2F">
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
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path
            fill="#627EEA"
            d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"
          />
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
          <circle cx="8" cy="8" r="6.6" fill="#CCFF00" />
          <path
            fill="#171A06"
            d="M5 11.6c0-3.9 2.5-6.6 6-7.1-.1 4.1-2.4 6.7-5.4 7.2L5 12.9Z"
          />
          <path stroke="#171A06" strokeWidth=".8" strokeLinecap="round" d="M4.6 13.2 5.6 11.7" />
        </svg>
      )
    // Arc (la L1 de Circle) no tiene todavía un logo público: el que había aquí
    // era inventado, y un logo falso confunde más que no poner ninguno. Cae al
    // puntito con el color de NETWORKS hasta que Circle publique el suyo.
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
  const t = useT()
  if (isPrivate || !ticker) {
    // La píldora vive en un span interno con tamaño fijo: así el className del
    // padre (p. ej. text-[15px] del ticker) nunca la agranda ni rompe el layout.
    return (
      <span
        className={cn('inline-flex shrink-0 items-center', className)}
        title={t.shared.tickerReserved}
      >
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-300/8 px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-wide text-amber-300/90">
          <Lock className="h-2.5 w-2.5" aria-hidden />
          {t.shared.private}
        </span>
      </span>
    )
  }
  return <span className={className}>${ticker}</span>
}

// ---------- Points pill ----------
export function PointsPill({ points, className }: { points: number; className?: string }) {
  const t = useT()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[#8FA83F]/25 bg-[#8FA83F]/8 px-2 py-0.5 text-[11px] font-semibold text-primary',
        className
      )}
      title={t.shared.points}
    >
      <Chapa silueta="star-medal" metal="oro" className="h-[18px] w-[18px]" placa />
      {points.toLocaleString()}
    </span>
  )
}

// ---------- Post kind badge ----------
/** `reply` = el post contesta a otro: se marca como respuesta, no como comentario suelto. */
export function KindBadge({ kind, reply }: { kind: string; reply?: boolean }) {
  const t = useT()
  const map: Record<string, { label: string; cls: string }> = {
    thesis: { label: t.shared.kinds.thesis, cls: 'bg-[#8FA83F]/12 text-primary border-[#8FA83F]/30' },
    call: { label: t.shared.kinds.call, cls: 'bg-amber-400/12 text-amber-300 border-amber-400/30' },
    trade: { label: t.shared.kinds.trade, cls: 'bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/25' },
    comment: { label: t.shared.kinds.comment, cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
    // Motivo de un voto en contra (el popó del Radar): siempre lleva su razón.
    fud: { label: t.shared.kinds.fud, cls: 'bg-amber-900/25 text-amber-200 border-amber-700/40' },
    reply: { label: t.shared.kinds.reply, cls: 'bg-sky-400/10 text-sky-300 border-sky-400/25' },
  }
  const meta = (reply && kind === 'comment' ? map.reply : map[kind]) ?? map.comment
  return (
    <span className={cn('rounded-md border px-1.5 py-px text-[10px] font-semibold', meta.cls)}>
      {meta.label}
    </span>
  )
}

// ---------- Countdown ----------
export function useCountdown(target: string | Date, dateConfirmed = true) {
  const [parts, setParts] = useState(() => countdownParts(target, dateConfirmed))
  const targetRef = useRef({ target, dateConfirmed })
  useEffect(() => {
    targetRef.current = { target, dateConfirmed }
  }, [target, dateConfirmed])
  useEffect(() => {
    const t = setInterval(
      () => setParts(countdownParts(targetRef.current.target, targetRef.current.dateConfirmed)),
      1000
    )
    return () => clearInterval(t)
  }, [])
  return parts
}

/**
 * Reloj compartido para listas que cambian solas al pasar la hora (el radar).
 * Un único intervalo para toda la lista, en vez de uno por tarjeta.
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** Fecha aún no confirmada: badge chiquito para poner junto a la fecha o el countdown. */
export function EstimatedDateBadge({ className }: { className?: string }) {
  const t = useT()
  return (
    <span
      title={t.shared.estimatedTitle}
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-amber-300/40 bg-amber-300/10 px-1 py-px text-[9px] font-black uppercase tracking-wide text-amber-300',
        className
      )}
    >
      {t.shared.estimated}
    </span>
  )
}

export function CountdownPill({
  target,
  size = 'md',
  className,
  compact,
  estimated,
  awaitingContract,
}: {
  target: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  /** Cuenta atrás corta para tarjetas angostas (con min+seg si queda <24h). */
  compact?: boolean
  /** La fecha es un estimado sin confirmar: antepone "~" y lo aclara en el title. */
  estimated?: boolean
  /** El launch no tiene contrato publicado: llegada la hora no se puede comprar, así que
   *  en vez de "En vivo/Lanzado" se avisa de que falta el CA. Pasa mucho: la gente
   *  publica el launch y nunca vuelve a poner el contrato. La salida de fondo es que
   *  lancen dentro de Cabal, donde el contrato se rellena solo al desplegar el token. */
  awaitingContract?: boolean
}) {
  const t = useT()
  const c = useCountdown(target, !estimated)
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
  // Con placa, el octógono necesita 16px para leerse; por debajo se cierra
  const iconCls = size === 'xs' ? 'h-4 w-4' : 'h-[18px] w-[18px]'
  // Rojo: en vivo o a punto de lanzar (<45 min) · Ámbar: pocas horas (<6 h) · Oliva: con tiempo
  const urgent = c.totalMs < 45 * 60_000
  const soon = c.totalMs < 6 * 3600_000
  if (awaitingContract && (c.live || c.recent || c.ended))
    return (
      <span
        title={t.shared.awaitingContractTitle}
        className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-amber-300/40 bg-amber-300/10 font-bold uppercase text-amber-300', cls, className)}
      >
        {t.shared.awaitingContract}
      </span>
    )
  if (c.live)
    return (
      <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-[#ff4d5e]/50 bg-[#ff4d5e]/12 font-bold uppercase text-[#ff6b7a]', cls, className)}>
        <span className={cn('live-dot-red shrink-0 rounded-full bg-[#ff4d5e]', dotCls)} />
        {t.shared.live}
      </span>
    )
  // Fecha estimada que ya pasó: no ha salido nada, sigue esperando al dev
  if (c.pending)
    return (
      <span
        title={t.shared.pendingTitle}
        className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-amber-300/40 bg-amber-300/10 font-bold uppercase text-amber-300', cls, className)}
      >
        {t.shared.pending}
      </span>
    )
  if (c.recent)
    return (
      <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-[#8FA83F]/30 bg-[#8FA83F]/8 font-bold uppercase text-primary', cls, className)}>
        {t.shared.launched}
      </span>
    )
  if (c.ended)
    return (
      <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-400', cls, className)}>
        {t.shared.finished}
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
          ? t.shared.estimatedDate
          : urgent
            ? t.shared.imminent
            : t.shared.timeToLaunch
      }
    >
      {urgent ? (
        <span className={cn('live-dot-red shrink-0 rounded-full bg-[#ff4d5e]', dotCls)} aria-hidden />
      ) : (
        <Chapa silueta="stopwatch" metal={soon ? 'oro' : 'verde'} className={cn('shrink-0', iconCls)} placa />
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
  const t = useT()
  const s = safetyCheck({ lpLocked, mintRevoked, top10Pct })
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <CheckItem ok={lpLocked} label={t.shared.lpLocked} showLabel={!compact} />
      <CheckItem ok={mintRevoked} label={t.shared.mintRevoked} showLabel={!compact} />
      <CheckItem ok={top10Pct <= 20} label={t.shared.top10(top10Pct)} showLabel={!compact} warn />
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
        {t.risk[s.level]} · {s.score}
      </span>
    </div>
  )
}
