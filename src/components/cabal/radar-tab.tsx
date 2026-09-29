'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronDown, Crosshair, Flame, Globe, LineChart, Lock, MessageSquare, Plus, Rocket, ShieldOff, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Chapa } from '@/components/cabal/chapa'
import { displayImageUrl } from '@/lib/remote-image'
import { CountdownPill, NetworkBadge, NetworkIcon, SafetyChecks, TickerLabel, TokenGlyph, useCountdown, useNow, OfficialBadge } from '@/components/cabal/shared'
import { fmtPct, launchPhase, networkMeta, timeAgo, type LaunchPhase } from '@/lib/cabal'
import { useHypeToggle, useLaunches, usePointRules } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { useT } from '@/lib/i18n/provider'
import { ReminderBell } from '@/components/cabal/reminder-bell'
import { FudButton } from '@/components/cabal/fud-button'
import { BoostCounter } from '@/components/cabal/ammo'
import { BoostHero } from '@/components/cabal/boost-hero'
import { useBoostedItems } from '@/lib/use-boosted'
import type { LaunchDTO } from '@/lib/types'

const NETWORK_FILTERS = ['all', 'solana', 'base', 'ethereum', 'bsc', 'tron', 'robinhood', 'arc'] as const

/** Mini-chip de rol: DEV = lo publicó el propio dev · SCOUT = encontrado por la comunidad */
function RoleChip({ role }: { role: 'dev' | 'community' }) {
  const t = useT()
  const dev = role === 'dev'
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1 py-px text-[9px] font-black uppercase tracking-wider',
        dev ? 'bg-[#8FA83F]/15 text-primary' : 'bg-white/8 text-zinc-400'
      )}
      title={dev ? t.radar.roleDevTitle : t.radar.roleScoutTitle}
    >
      {dev ? t.radar.roleDev : t.radar.roleScout}
    </span>
  )
}

type StatusFilter = 'active' | 'ended' | 'all' | 'recent'

/**
 * "Próximos" incluye lo que se está lanzando ahora (30 min tras la hora) y lo
 * que tenía fecha estimada y todavía no ha salido. Lo demás, a Finalizados.
 */
const STATUS_TABS: StatusFilter[] = ['active', 'ended', 'all', 'recent']

export function RadarTab() {
  const t = useT()
  const { data: launches, isLoading } = useLaunches()
  const rules = usePointRules()
  const router = useRouter()
  const { openLaunch } = useUI()
  const [network, setNetwork] = useState<string>('all')
  const [sort, setSort] = useState<'soon' | 'hype'>('soon')
  // Por defecto lo que sigue vivo: antes el orden por fecha ascendente dejaba los
  // launches finalizados más antiguos arriba del todo del radar.
  const [status, setStatus] = useState<StatusFilter>('active')

  // El `status` del DTO se calcula en el servidor y viaja cacheado: con la
  // pestaña abierta un launch se quedaba en Próximos pasada su hora. Aquí la
  // fase se recalcula cada segundo, así que la tarjeta salta sola de pestaña.
  const now = useNow()
  const phaseOf = useMemo(() => {
    const map = new Map<string, LaunchPhase>()
    for (const l of launches ?? []) map.set(l.id, launchPhase(l.launchAt, l.dateConfirmed, now))
    return (l: LaunchDTO) => map.get(l.id) ?? 'upcoming'
  }, [launches, now])

  const byNetwork = useMemo(
    () => (launches ?? []).filter((l) => network === 'all' || l.network === network),
    [launches, network]
  )

  const counts = useMemo(() => {
    const ended = byNetwork.filter((l) => phaseOf(l) === 'ended').length
    return { active: byNetwork.length - ended, ended, all: byNetwork.length, recent: byNetwork.length }
  }, [byNetwork, phaseOf])

  const filtered = useMemo(() => {
    // Recién agregados: todo, del último que se subió a Cabal al primero
    if (status === 'recent') {
      const added = (l: LaunchDTO) => +new Date(l.createdAt)
      return [...byNetwork].sort((a, b) => added(b) - added(a))
    }
    const list =
      status === 'all'
        ? byNetwork
        : byNetwork.filter((l) => (status === 'ended') === (phaseOf(l) === 'ended'))
    const at = (l: { launchAt: string }) => +new Date(l.launchAt)
    return [...list].sort((a, b) => {
      // La munición manda dentro del filtro elegido: quien paga, sube.
      const ammo = (b.boost?.bullets ?? 0) - (a.boost?.bullets ?? 0)
      if (ammo !== 0) return ammo
      if (sort === 'hype') return b.hype - a.hype
      // Por fecha, lo activo va primero y del más cercano al más lejano (los que
      // se están lanzando ahora quedan arriba); lo finalizado, del más reciente
      // al más antiguo, que es lo que interesa al repasar lo que ya salió.
      const aEnded = phaseOf(a) === 'ended'
      const bEnded = phaseOf(b) === 'ended'
      if (aEnded !== bEnded) return aEnded ? 1 : -1
      return aEnded ? at(b) - at(a) : at(a) - at(b)
    })
  }, [byNetwork, sort, status, phaseOf])

  // El nº1 en munición de todo Cabal (launch o token): se queda el banner.
  const topBoost = useBoostedItems()[0] ?? null

  const featured = useMemo(() => {
    // Solo lo que aún no ha llegado a su hora: un pendiente o un recién lanzado
    // no son un buen héroe (no hay cuenta atrás que enseñar).
    const upcoming = (launches ?? []).filter((l) => phaseOf(l) === 'upcoming')
    if (upcoming.length === 0) return null
    // soonest with high hype gets the hero
    return [...upcoming].sort((a, b) => b.hype - a.hype - (b.hype - a.hype) * 0.0000001 * (+new Date(b.launchAt) - +new Date(a.launchAt)))[0] ?? upcoming[0]
  }, [launches, phaseOf])

  return (
    <div className="space-y-4">
      {/* El banner es de quien más munición tenga; si no hay ninguno, manda el hype */}
      {topBoost ? (
        <BoostHero item={topBoost} />
      ) : (
        featured && <FeaturedLaunch launch={featured} onOpen={() => openLaunch(featured.id)} />
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Chips con wrap: todas las redes visibles sin scroll oculto (móvil incluido) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {NETWORK_FILTERS.map((n) => (
            <button
              key={n}
              onClick={() => setNetwork(n)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                network === n
                  ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary neon-shadow'
                  : 'border-white/10 bg-[#121410] text-muted-foreground hover:border-[#8FA83F]/30 hover:text-foreground'
              )}
            >
              {n === 'all' ? (
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" aria-hidden /> {t.radar.all}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <NetworkIcon network={n} className="h-3 w-3" aria-hidden />
                  {networkMeta(n).short}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Estado: lo que está por salir o ya salió (desplegable para ahorrar una fila) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t.radar.statusAria}
              className="flex items-center gap-1.5 rounded-full border border-[#8FA83F]/50 bg-[#8FA83F]/10 px-3 py-1.5 text-xs font-semibold text-primary outline-none"
            >
              {t.radar.status[status]}
              <span className="rounded-full bg-[#8FA83F]/20 px-1.5 font-mono text-[10px]">{counts[status]}</span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 border-white/10 bg-popover">
              <DropdownMenuRadioGroup value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                {STATUS_TABS.map((key) => (
                  <DropdownMenuRadioItem key={key} value={key} className="justify-between text-[13px]">
                    {t.radar.status[key]}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{counts[key]}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => setSort('soon')}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', sort === 'soon' ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground')}
          >
            <span className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" aria-hidden /> {t.radar.byDate}
            </span>
          </button>
          <button
            onClick={() => setSort('hype')}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', sort === 'hype' ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground')}
          >
            <span className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" aria-hidden /> {t.radar.mostHype}
            </span>
          </button>
          <Button
            size="sm"
            onClick={() => router.push('/publicar')}
            className="hidden gap-1 px-3 text-xs font-bold md:inline-flex"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> {t.radar.publish}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-white/8 bg-[#121410]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 py-16 text-center">
          <Rocket className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-semibold">{t.radar.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{t.radar.emptyBody(rules.points_launch)}</p>
          </div>
          <Button onClick={() => router.push('/publicar')} className="font-bold">
            {t.radar.publishLaunch}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((l) => (
            <LaunchCard key={l.id} launch={l} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * El banner del proyecto, de fondo dentro de la tarjeta: entra por la derecha y
 * se apaga hacia la izquierda y hacia abajo, que es donde va el texto. Da
 * carácter a la ficha sin comerse la legibilidad. Si la imagen no carga
 * desaparece entera y la tarjeta queda como siempre, igual que en el detalle.
 */
function CardBanner({ src }: { src?: string | null }) {
  const url = displayImageUrl(src)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!url || failedUrl === url) return null
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <Image
        src={url}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 480px"
        className="object-cover opacity-50 transition-opacity duration-300 group-hover:opacity-70"
        unoptimized
        onError={() => setFailedUrl(url)}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#121410] via-[#121410]/85 to-[#121410]/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#121410] via-[#121410]/55 to-transparent" />
    </div>
  )
}

function FeaturedLaunch({ launch, onOpen }: { launch: LaunchDTO; onOpen: () => void }) {
  const t = useT()
  const hype = useHypeToggle()
  const c = useCountdown(launch.launchAt, launch.dateConfirmed)
  // Solo lo que todavía no ha llegado a su hora puede ser "inminente": antes un
  // launch ya lanzado (totalMs 0) se pintaba de rojo como si fuera a salir.
  const urgent = c.totalMs > 0 && c.totalMs < 45 * 60_000
  const soon = c.pending || (c.totalMs > 0 && !urgent && c.totalMs < 6 * 3600_000)
  // Antes toda la tarjeta era un <button>, y dentro de un botón no pueden vivir
  // otros botones: por eso el destacado solo enseñaba el número de hypes. Ahora
  // es un contenedor clicable (con teclado, como antes) y el hype y el popó se
  // votan aquí mismo, sin tener que abrir la ficha.
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'card-surface group relative isolate block w-full cursor-pointer overflow-hidden rounded-2xl border p-5 text-left transition-all sm:p-6',
        c.live || urgent ? 'border-[#ff4d5e]/40 hover:border-[#ff4d5e]/60' : 'border-white/12 hover:border-[#8FA83F]/50'
      )}
    >
      <CardBanner src={launch.banner} />
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#8FA83F]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="animate-float-slow shrink-0">
          <TokenGlyph src={launch.image} ticker={launch.ticker ?? launch.name} size="xl" className="h-16 w-16" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground">
              {t.radar.featured}
            </span>
            <NetworkBadge network={launch.network} />
            <RoleChip role={launch.submitterRole} />
            <button
              onClick={(e) => {
                e.stopPropagation()
                hype.mutate(launch.id)
              }}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition-all active:scale-95',
                launch.hyped
                  ? 'border-[#8FA83F]/50 bg-[#8FA83F]/15 text-primary'
                  : 'border-white/10 text-amber-300 hover:border-[#8FA83F]/40 hover:text-primary'
              )}
              aria-label={t.radar.giveHype}
            >
              <Chapa silueta="flame" metal={launch.hyped ? 'oro' : 'acero'} className="h-5 w-5" placa />{' '}
              {t.radar.hypes(launch.hype)}
            </button>
            <FudButton launchId={launch.id} fud={launch.fud} fudded={launch.fudded} className="py-0.5" />
          </div>
          <h2 className="font-display mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-xl font-bold sm:text-2xl">
            <span className="min-w-0 truncate">{launch.name}</span>
            <TickerLabel ticker={launch.ticker} isPrivate={launch.isPrivate} className="text-primary text-glow" />
            {launch.verified && <OfficialBadge label title={t.radar.officialTitle} />}
          </h2>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{launch.description}</p>
        </div>
        <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {c.live
                ? t.radar.launchingNow
                : c.recent
                  ? t.radar.alreadyOut
                  : c.pending
                    ? t.radar.estimatedDate
                    : t.radar.launchesIn}
            </p>
            <p
              className={cn(
                'font-mono text-2xl font-bold tabular-nums text-glow sm:text-3xl',
                c.live || urgent ? 'text-[#ff6b7a]' : soon ? 'text-amber-300' : 'text-primary',
                (c.live || c.recent || c.pending || urgent) && 'text-base'
              )}
            >
              {c.text}
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}

export function LaunchCard({ launch }: { launch: LaunchDTO }) {
  const t = useT()
  const hype = useHypeToggle()
  const { openLaunch } = useUI()
  const c = useCountdown(launch.launchAt, launch.dateConfirmed)
  const urgent = c.totalMs > 0 && c.totalMs < 45 * 60_000

  return (
    <article
      onClick={() => openLaunch(launch.id)}
      className={cn(
        'card-surface group relative isolate flex min-w-0 cursor-pointer flex-col gap-3 overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-0.5',
        launch.boost?.golden
          ? 'border-amber-300/55 shadow-[0_0_18px_rgba(255,176,32,0.1)] hover:border-amber-300/80'
          : launch.boost
            ? 'border-amber-400/30 hover:border-amber-300/50'
            : c.live || urgent
              ? 'border-[#ff4d5e]/40 shadow-[0_0_14px_rgba(255,77,94,0.08)] hover:border-[#ff4d5e]/60'
              : 'border-white/10 hover:border-[#8FA83F]/30'
      )}
    >
      <CardBanner src={launch.banner} />
      <div className="flex items-start gap-2.5">
        <TokenGlyph src={launch.image} ticker={launch.ticker ?? launch.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <TickerLabel ticker={launch.ticker} isPrivate={launch.isPrivate} className="shrink-0 font-display text-[15px] font-bold text-primary" />
            <span className="min-w-0 truncate text-[13px] font-semibold text-foreground/80">{launch.name}</span>
            {launch.verified && <OfficialBadge className="self-center" title={t.radar.officialTitle} />}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <NetworkBadge network={launch.network} className="shrink-0" />
            <RoleChip role={launch.submitterRole} />
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              {timeAgo(launch.createdAt)} · @{launch.createdBy.handle}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <CountdownPill target={launch.launchAt} compact size="xs" estimated={!launch.dateConfirmed} className="mt-0.5" />
          {launch.boost && <BoostCounter boost={launch.boost} size="xs" />}
        </div>
      </div>

      <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{launch.description}</p>

      <SafetyChecks lpLocked={launch.lpLocked} mintRevoked={launch.mintRevoked} top10Pct={launch.top10Pct} />

      {/* El pie se apoya en un velo verde difuminado: sobre el negro puro los
          iconos de chapa se perdian */}
      <div className="relative -mx-4 -mb-4 mt-auto flex flex-wrap items-center gap-2 border-t border-[#8FA83F]/20 bg-gradient-to-t from-[#8FA83F]/25 via-[#8FA83F]/10 to-transparent px-4 pb-3 pt-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            hype.mutate(launch.id)
          }}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-all active:scale-95',
            launch.hyped
              ? 'border-[#8FA83F]/50 bg-[#8FA83F]/15 text-primary'
              : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/40 hover:text-primary'
          )}
          aria-label={t.radar.giveHype}
        >
          <Chapa silueta="flame" metal={launch.hyped ? 'oro' : 'acero'} className="h-5 w-5" placa />
          {launch.hype}
        </button>
        {/* El voto en contra, al lado del fueguito: pide motivo antes de contar */}
        <FudButton launchId={launch.id} fud={launch.fud} fudded={launch.fudded} />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Chapa silueta="chat-bubble" metal="acero" className="h-5 w-5" placa />
          {launch.postsCount}
        </span>
        <ReminderBell launchId={launch.id} launchAt={launch.launchAt} />
        {launch.contract && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              openLaunch(launch.id)
            }}
            className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-all hover:border-[#8FA83F]/40 hover:text-primary active:scale-95"
            title={t.radar.chartTitle}
            aria-label={t.radar.chartAria}
          >
            <LineChart className="h-3.5 w-3.5" aria-hidden />
            {t.radar.chart}
          </button>
        )}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          {launch.lpLocked ? <Lock className="h-3 w-3 text-primary" /> : <ShieldOff className="h-3 w-3 text-amber-300" />}
          {launch.createdBy.isDev && launch.createdBy.walletVerified
            ? t.radar.devVerified
            : launch.createdBy.isDev
              ? t.radar.devUnverified
              : t.radar.communityPost}
        </span>
      </div>
    </article>
  )
}
