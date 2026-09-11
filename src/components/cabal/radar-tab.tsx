'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Flame, Globe, LineChart, Lock, MessageSquare, Plus, Rocket, ShieldOff, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { CountdownPill, NetworkBadge, NetworkIcon, SafetyChecks, TickerLabel, TokenGlyph, useCountdown } from '@/components/cabal/shared'
import { fmtPct, networkMeta, timeAgo } from '@/lib/cabal'
import { useHypeToggle, useLaunches } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import type { LaunchDTO } from '@/lib/types'

const NETWORK_FILTERS = ['all', 'solana', 'base', 'ethereum', 'bsc', 'tron', 'robinhood'] as const

/** Mini-chip de rol: DEV = lo publicó el propio dev · SCOUT = encontrado por la comunidad */
function RoleChip({ role }: { role: 'dev' | 'community' }) {
  const dev = role === 'dev'
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1 py-px text-[9px] font-black uppercase tracking-wider',
        dev ? 'bg-[#8FA83F]/15 text-primary' : 'bg-white/8 text-zinc-400'
      )}
      title={dev ? 'Publicado por el dev del proyecto' : 'Encontrado por la comunidad'}
    >
      {dev ? 'DEV' : 'SCOUT'}
    </span>
  )
}

type StatusFilter = 'active' | 'ended' | 'all'

/** "Próximos" incluye lo que se está lanzando ahora (hasta 48h después): sigue vivo. */
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'active', label: 'Próximos' },
  { key: 'ended', label: 'Finalizados' },
  { key: 'all', label: 'Todos' },
]

export function RadarTab() {
  const { data: launches, isLoading } = useLaunches()
  const router = useRouter()
  const { openLaunch } = useUI()
  const [network, setNetwork] = useState<string>('all')
  const [sort, setSort] = useState<'soon' | 'hype'>('soon')
  // Por defecto lo que sigue vivo: antes el orden por fecha ascendente dejaba los
  // launches finalizados más antiguos arriba del todo del radar.
  const [status, setStatus] = useState<StatusFilter>('active')

  const byNetwork = useMemo(
    () => (launches ?? []).filter((l) => network === 'all' || l.network === network),
    [launches, network]
  )

  const counts = useMemo(() => {
    const ended = byNetwork.filter((l) => l.status === 'ended').length
    return { active: byNetwork.length - ended, ended, all: byNetwork.length }
  }, [byNetwork])

  const filtered = useMemo(() => {
    const list =
      status === 'all'
        ? byNetwork
        : byNetwork.filter((l) => (status === 'ended') === (l.status === 'ended'))
    const at = (l: { launchAt: string }) => +new Date(l.launchAt)
    return [...list].sort((a, b) => {
      if (sort === 'hype') return b.hype - a.hype
      // Por fecha, lo activo va primero y del más cercano al más lejano (los que
      // se están lanzando ahora quedan arriba); lo finalizado, del más reciente
      // al más antiguo, que es lo que interesa al repasar lo que ya salió.
      const aEnded = a.status === 'ended'
      const bEnded = b.status === 'ended'
      if (aEnded !== bEnded) return aEnded ? 1 : -1
      return aEnded ? at(b) - at(a) : at(a) - at(b)
    })
  }, [byNetwork, sort, status])

  const featured = useMemo(() => {
    const upcoming = (launches ?? []).filter((l) => l.status === 'upcoming')
    if (upcoming.length === 0) return null
    // soonest with high hype gets the hero
    return [...upcoming].sort((a, b) => b.hype - a.hype - (b.hype - a.hype) * 0.0000001 * (+new Date(b.launchAt) - +new Date(a.launchAt)))[0] ?? upcoming[0]
  }, [launches])

  return (
    <div className="space-y-4">
      {/* Hero: featured launch */}
      {featured && <FeaturedLaunch launch={featured} onOpen={() => openLaunch(featured.id)} />}

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
                  <Globe className="h-3.5 w-3.5" aria-hidden /> Todas
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
              aria-label="Estado de los launches"
              className="flex items-center gap-1.5 rounded-full border border-[#8FA83F]/50 bg-[#8FA83F]/10 px-3 py-1.5 text-xs font-semibold text-primary outline-none"
            >
              {STATUS_TABS.find((t) => t.key === status)?.label}
              <span className="rounded-full bg-[#8FA83F]/20 px-1.5 font-mono text-[10px]">{counts[status]}</span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 border-white/10 bg-popover">
              <DropdownMenuRadioGroup value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                {STATUS_TABS.map((t) => (
                  <DropdownMenuRadioItem key={t.key} value={t.key} className="justify-between text-[13px]">
                    {t.label}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{counts[t.key]}</span>
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
              <Timer className="h-3.5 w-3.5" aria-hidden /> Por fecha
            </span>
          </button>
          <button
            onClick={() => setSort('hype')}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', sort === 'hype' ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground')}
          >
            <span className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" aria-hidden /> Más hype
            </span>
          </button>
          <Button
            size="sm"
            onClick={() => router.push('/publicar')}
            className="hidden h-8 gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F] md:inline-flex"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Publicar
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
            <p className="font-semibold">No hay launches con este filtro</p>
            <p className="text-sm text-muted-foreground">Sé el primero en avisar a la comunidad (+40 puntos)</p>
          </div>
          <Button onClick={() => router.push('/publicar')} className="bg-primary font-bold text-primary-foreground hover:bg-[#8FA83F]">
            Publicar lanzamiento
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

function FeaturedLaunch({ launch, onOpen }: { launch: LaunchDTO; onOpen: () => void }) {
  const c = useCountdown(launch.launchAt)
  const urgent = !c.live && !c.ended && c.totalMs < 45 * 60_000
  const soon = !c.live && !c.ended && !urgent && c.totalMs < 6 * 3600_000
  return (
    <button
      onClick={onOpen}
      className={cn(
        'card-surface group relative block w-full overflow-hidden rounded-2xl border p-5 text-left transition-all sm:p-6',
        c.live || urgent ? 'border-[#ff4d5e]/40 hover:border-[#ff4d5e]/60' : 'border-white/12 hover:border-[#8FA83F]/50'
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#8FA83F]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="animate-float-slow shrink-0">
          <TokenGlyph src={launch.image} ticker={launch.ticker ?? launch.name} size="xl" className="h-16 w-16" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground">
              Destacado
            </span>
            <NetworkBadge network={launch.network} />
            <RoleChip role={launch.submitterRole} />
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-300">
              <Flame className="h-3.5 w-3.5" /> {launch.hype} hypes
            </span>
          </div>
          <h2 className="font-display mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-xl font-bold sm:text-2xl">
            <span className="min-w-0 truncate">{launch.name}</span>
            <TickerLabel ticker={launch.ticker} isPrivate={launch.isPrivate} className="text-primary text-glow" />
          </h2>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{launch.description}</p>
        </div>
        <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {c.live ? 'Lanzando ahora' : 'Lanza en'}
            </p>
            <p
              className={cn(
                'font-mono text-2xl font-bold tabular-nums text-glow sm:text-3xl',
                c.live || urgent ? 'text-[#ff6b7a]' : soon ? 'text-amber-300' : 'text-primary',
                (c.live || urgent) && 'text-base'
              )}
            >
              {c.text}
            </p>
          </div>
        </div>
      </div>
    </button>
  )
}

export function LaunchCard({ launch }: { launch: LaunchDTO }) {
  const hype = useHypeToggle()
  const { openLaunch } = useUI()
  const c = useCountdown(launch.launchAt)
  const urgent = !c.live && !c.ended && c.totalMs < 45 * 60_000

  return (
    <article
      onClick={() => openLaunch(launch.id)}
      className={cn(
        'card-surface group flex min-w-0 cursor-pointer flex-col gap-3 overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-0.5',
        c.live || urgent
          ? 'border-[#ff4d5e]/40 shadow-[0_0_14px_rgba(255,77,94,0.08)] hover:border-[#ff4d5e]/60'
          : 'border-white/10 hover:border-[#8FA83F]/30'
      )}
    >
      <div className="flex items-start gap-2.5">
        <TokenGlyph src={launch.image} ticker={launch.ticker ?? launch.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <TickerLabel ticker={launch.ticker} isPrivate={launch.isPrivate} className="shrink-0 font-display text-[15px] font-bold text-primary" />
            <span className="min-w-0 truncate text-[13px] font-semibold text-foreground/80">{launch.name}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <NetworkBadge network={launch.network} className="shrink-0" />
            <RoleChip role={launch.submitterRole} />
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              {timeAgo(launch.createdAt)} · @{launch.createdBy.handle}
            </span>
          </div>
        </div>
        <CountdownPill target={launch.launchAt} compact size="xs" className="mt-0.5 shrink-0" />
      </div>

      <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{launch.description}</p>

      <SafetyChecks lpLocked={launch.lpLocked} mintRevoked={launch.mintRevoked} top10Pct={launch.top10Pct} />

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/8 pt-2.5">
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
          aria-label="Dar hype"
        >
          <Flame className={cn('h-3.5 w-3.5', launch.hyped && 'fill-primary')} />
          {launch.hype}
        </button>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          {launch.postsCount}
        </span>
        {launch.contract && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              openLaunch(launch.id)
            }}
            className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-all hover:border-[#8FA83F]/40 hover:text-primary active:scale-95"
            title="Ver gráfico en vivo en el detalle"
            aria-label="Abrir gráfico en vivo en el detalle"
          >
            <LineChart className="h-3.5 w-3.5" aria-hidden />
            Gráfico
          </button>
        )}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          {launch.lpLocked ? <Lock className="h-3 w-3 text-primary" /> : <ShieldOff className="h-3 w-3 text-amber-300" />}
          {launch.createdBy.isDev && launch.createdBy.walletVerified ? 'Dev verificado' : launch.createdBy.isDev ? 'Dev sin verificar' : 'Post de comunidad'}
        </span>
      </div>
    </article>
  )
}
