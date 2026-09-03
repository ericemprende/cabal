'use client'

import { useMemo, useState } from 'react'
import { Flame, Globe, Lock, MessageSquare, Plus, Rocket, ShieldOff, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CountdownPill, NetworkBadge, SafetyChecks, TokenGlyph, useCountdown } from '@/components/cabal/shared'
import { fmtPct, networkMeta, timeAgo } from '@/lib/cabal'
import { useHypeToggle, useLaunches } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import type { LaunchDTO } from '@/lib/types'

const NETWORK_FILTERS = ['all', 'solana', 'base', 'ethereum', 'bsc', 'tron'] as const

export function RadarTab() {
  const { data: launches, isLoading } = useLaunches()
  const { setPostLaunchOpen, openLaunch } = useUI()
  const [network, setNetwork] = useState<string>('all')
  const [sort, setSort] = useState<'soon' | 'hype'>('soon')

  const filtered = useMemo(() => {
    let list = (launches ?? []).filter((l) => network === 'all' || l.network === network)
    list = [...list].sort((a, b) =>
      sort === 'soon' ? +new Date(a.launchAt) - +new Date(b.launchAt) : b.hype - a.hype
    )
    return list
  }, [launches, network, sort])

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
        <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto">
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
                networkMeta(n).short
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSort('soon')}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', sort === 'soon' ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground')}
          >
            <span className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" aria-hidden /> Próximos
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
            onClick={() => setPostLaunchOpen(true)}
            className="hidden h-8 gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F] md:inline-flex"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Publicar
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
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
          <Button onClick={() => setPostLaunchOpen(true)} className="bg-primary font-bold text-primary-foreground hover:bg-[#8FA83F]">
            Publicar lanzamiento
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
  return (
    <button
      onClick={onOpen}
      className="card-surface group relative block w-full overflow-hidden rounded-2xl border border-white/12 p-5 text-left transition-all hover:border-[#8FA83F]/50 sm:p-6"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#8FA83F]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="animate-float-slow shrink-0">
          <TokenGlyph src={launch.image} ticker={launch.ticker} size="xl" className="h-16 w-16" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground">
              Destacado
            </span>
            <NetworkBadge network={launch.network} />
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-300">
              <Flame className="h-3.5 w-3.5" /> {launch.hype} hypes
            </span>
          </div>
          <h2 className="font-display mt-1 truncate text-xl font-bold sm:text-2xl">
            {launch.name} <span className="text-primary text-glow">${launch.ticker}</span>
          </h2>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{launch.description}</p>
        </div>
        <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lanza en</p>
            <p className={cn('font-mono text-2xl font-bold tabular-nums text-glow text-primary sm:text-3xl', c.live && 'text-base')}>
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

  return (
    <article
      onClick={() => openLaunch(launch.id)}
      className={cn(
        'card-surface group flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5',
        c.live ? 'border-[#8FA83F]/40 neon-shadow' : 'border-white/10 hover:border-[#8FA83F]/30'
      )}
    >
      <div className="flex items-start gap-3">
        <TokenGlyph src={launch.image} ticker={launch.ticker} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 font-display text-[15px] font-bold text-primary">${launch.ticker}</span>
            <span className="truncate text-[13px] font-semibold text-foreground/80">{launch.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <NetworkBadge network={launch.network} />
            <span className="truncate text-[11px] text-muted-foreground">
              {timeAgo(launch.createdAt)} · @{launch.createdBy.handle}
            </span>
          </div>
        </div>
        <CountdownPill target={launch.launchAt} />
      </div>

      <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{launch.description}</p>

      <SafetyChecks lpLocked={launch.lpLocked} mintRevoked={launch.mintRevoked} top10Pct={launch.top10Pct} />

      <div className="mt-auto flex items-center gap-2 border-t border-white/8 pt-2.5">
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
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          {launch.lpLocked ? <Lock className="h-3 w-3 text-primary" /> : <ShieldOff className="h-3 w-3 text-amber-300" />}
          {launch.createdBy.isDev && launch.createdBy.walletVerified ? 'Dev verificado' : launch.createdBy.isDev ? 'Dev sin verificar' : 'Post de comunidad'}
        </span>
      </div>
    </article>
  )
}
