'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Crown, MessageCircle, MessageSquare, Radio, Rocket, Timer, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CountdownPill, NetworkBadge, PointsPill, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { LaunchActivityCard, useActivity } from '@/components/cabal/launch-activity'
import { useFollowToggle, useLaunches, useLeaderboard, usePointRules } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { useIsOnline, useOnlineCount, useOnlineMembers } from '@/lib/presence'
import { LiveChat } from '@/components/cabal/live-chat'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fmtNum } from '@/lib/cabal'

type ActivityFilter = 'all' | 'launch' | 'post' | 'chat'

const ACTIVITY_FILTERS: { value: ActivityFilter; label: string; icon: typeof Radio }[] = [
  { value: 'all', label: 'Todo', icon: Radio },
  { value: 'launch', label: 'Launches', icon: Rocket },
  { value: 'post', label: 'Tesis', icon: MessageSquare },
  { value: 'chat', label: 'Chat en vivo', icon: MessageCircle },
]

/** Lista de quién está conectado ahora mismo, para el tooltip del icono del chat. */
function OnlineTooltipContent() {
  const members = useOnlineMembers()
  if (members.length === 0) return <p className="text-xs">Nadie conectado todavía</p>
  return (
    <div className="max-w-[220px] space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {members.length} conectado{members.length === 1 ? '' : 's'}
      </p>
      <div className="space-y-1">
        {members.slice(0, 8).map((m) => (
          <div key={m.id} className="flex items-center gap-1.5">
            <UserAvatar name={m.name} handle={m.handle} src={m.avatar} size="xs" online />
            <span className="truncate text-xs">{m.name}</span>
          </div>
        ))}
        {members.length > 8 && (
          <p className="text-[10px] text-muted-foreground">+{members.length - 8} más</p>
        )}
      </div>
    </div>
  )
}

// ---------- Left: live activity ----------
export function LeftFeed() {
  const { items: activity, isLoading } = useActivity(30)
  const { openLaunch } = useUI()
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const onlineCount = useOnlineCount()
  // Colapsable hacia la izquierda: en vez de solo ocultar el contenido, el
  // panel se encoge a una tira angosta y el feed del medio gana ese ancho
  // (es flex-1 en el layout, así que crece solo).
  const [collapsed, setCollapsed] = useState(false)

  const filtered = useMemo(
    () => (filter === 'all' ? activity : activity.filter((item) => item.type === filter)),
    [activity, filter]
  )

  return (
    <aside
      className={cn('hidden shrink-0 transition-[width] duration-200 lg:block', collapsed ? 'w-11' : 'w-[440px]')}
      aria-label="Actividad en vivo"
    >
      <div className="sticky top-[72px] max-h-[calc(100vh-100px)] overflow-y-auto pr-1">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            'mb-2 flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/5',
            collapsed ? 'w-9 justify-center' : 'w-full'
          )}
          aria-expanded={!collapsed}
          aria-controls="cabal-activity-panel"
          title={collapsed ? 'Mostrar Actividad del Cabal' : 'Ocultar Actividad del Cabal'}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          ) : (
            <>
              <Radio className="h-3.5 w-3.5 text-primary live-dot" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Actividad del Cabal</p>
              <ChevronLeft className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </>
          )}
        </button>

        {/* Colapsado: icono del chat que sigue accesible, con tooltip de quién está conectado */}
        {collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(false)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/5"
                aria-label={`Chat en vivo, ${onlineCount} conectados`}
              >
                <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                {onlineCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#0a0b08] bg-emerald-400" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <OnlineTooltipContent />
            </TooltipContent>
          </Tooltip>
        )}

        {!collapsed && (
          <div id="cabal-activity-panel">
            {/* Filtro por tipo de actividad */}
            <div className="mb-3 flex items-center gap-1 px-1" role="tablist" aria-label="Filtrar actividad">
              {ACTIVITY_FILTERS.map(({ value, label, icon: Icon }) =>
                value === 'chat' ? (
                  <Tooltip key={value}>
                    <TooltipTrigger asChild>
                      <button
                        role="tab"
                        aria-selected={filter === value}
                        onClick={() => setFilter(value)}
                        className={cn(
                          'relative flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all',
                          filter === value
                            ? 'bg-[#8FA83F]/12 text-primary'
                            : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                        )}
                      >
                        <Icon className="h-3 w-3" aria-hidden />
                        {label}
                        {onlineCount > 0 && (
                          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <OnlineTooltipContent />
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    key={value}
                    role="tab"
                    aria-selected={filter === value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all',
                      filter === value
                        ? 'bg-[#8FA83F]/12 text-primary'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {label}
                  </button>
                )
              )}
            </div>

            {filter === 'chat' ? (
              <LiveChat />
            ) : (
              <div className="space-y-2">
                {isLoading &&
                  [...Array(6)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[#121410]" />)}
                {!isLoading && filtered.length === 0 && (
                  <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-muted-foreground">
                    Sin actividad de este tipo por ahora
                  </p>
                )}
                {filtered.map((item) =>
                  item.type === 'launch' ? (
                    <LaunchActivityCard
                      key={`launch-${item.kind}-${item.launch.id}`}
                      launch={item.launch}
                      kind={item.kind}
                      compact
                      onOpen={() => openLaunch(item.launch.id)}
                    />
                  ) : (
                    <PostCard key={item.post.id} post={item.post} compact />
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

// ---------- Right: next launches + top callers ----------
export function RightRail() {
  const { data: launches } = useLaunches()
  const { data: leaderboard } = useLeaderboard()
  const follow = useFollowToggle()
  const rules = usePointRules()
  const router = useRouter()
  const { openLaunch } = useUI()

  const next = useMemo(
    () =>
      (launches ?? [])
        .filter((l) => l.status === 'upcoming')
        .sort((a, b) => +new Date(a.launchAt) - +new Date(b.launchAt))
        .slice(0, 4),
    [launches]
  )
  const top = (leaderboard?.callers ?? []).slice(0, 6)

  return (
    <aside className="hidden w-[290px] shrink-0 xl:block" aria-label="Próximos lanzamientos y top traders">
      <div className="sticky top-[72px] max-h-[calc(100vh-140px)] space-y-4 overflow-y-auto pl-1">
        {/* Next launches */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <Timer className="h-3.5 w-3.5" aria-hidden /> Próximos a lanzar
            </p>
            <button onClick={() => router.push('/publicar')} className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline">
              <Zap className="h-3 w-3" aria-hidden /> +{rules.points_launch}
            </button>
          </div>
          <div className="space-y-2">
            {next.map((l) => (
              <button
                key={l.id}
                onClick={() => openLaunch(l.id)}
                className="card-surface flex w-full items-center gap-2.5 rounded-xl border border-white/10 p-2.5 text-left transition-colors hover:border-[#8FA83F]/30"
              >
                <TokenGlyph src={l.image} ticker={l.ticker ?? l.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">
                    {l.isPrivate || !l.ticker ? (
                      <span className="text-amber-300/90">Privado</span>
                    ) : (
                      l.ticker
                    )}{' '}
                    <span className="font-normal text-muted-foreground">· {l.name}</span>
                  </p>
                  <div className="mt-0.5"><NetworkBadge network={l.network} /></div>
                </div>
                <CountdownPill target={l.launchAt} size="sm" estimated={!l.dateConfirmed} />
              </button>
            ))}
            {next.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-muted-foreground">
                Radar despejado… publica el próximo launch
              </p>
            )}
          </div>
        </section>

        {/* Top callers */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <Crown className="h-3.5 w-3.5 text-amber-300/80" aria-hidden /> Top del Cabal
          </p>
          <div className="card-surface space-y-0.5 rounded-xl border border-white/10 p-1.5">
            {top.map((c, i) => (
              <TopCallerRow key={c.user.id} caller={c} rank={i} onFollow={() => follow.mutate(c.user.id)} />
            ))}
          </div>
        </section>

        {/* Points CTA */}
        <section className="rounded-xl border border-white/10 bg-gradient-to-br from-[#8FA83F]/10 to-transparent p-4">
          <p className="flex items-center gap-1.5 font-display text-sm font-bold text-primary">
            <Zap className="h-4 w-4" aria-hidden /> Puntos Cabal
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground/75">
            Publica launches y tesis → gana puntos → cámbialos por tokens cuando lancemos $CABAL.
          </p>
          <button onClick={() => router.push('/publicar')} className="mt-2.5 w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90">
            Publicar mi primer launch
          </button>
        </section>
      </div>
    </aside>
  )
}

function TopCallerRow({
  caller,
  rank,
  onFollow,
}: {
  caller: import('@/lib/types').LeaderboardEntryDTO
  rank: number
  onFollow: () => void
}) {
  const online = useIsOnline(caller.user.id)
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/5">
      <span className={cn('w-4 text-center text-[11px] font-bold', rank === 0 ? 'text-amber-300' : 'text-muted-foreground')}>
        {rank + 1}
      </span>
      <Link href={`/u/${caller.user.handle}`} className="flex min-w-0 flex-1 items-center gap-2.5">
        <UserAvatar name={caller.user.name} handle={caller.user.handle} src={caller.user.avatar} size="xs" verified={caller.user.walletVerified} online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{caller.user.name}</p>
          <p className="truncate text-[10px] text-muted-foreground">{fmtNum(caller.user.followers)} seguidores</p>
        </div>
      </Link>
      {caller.user.isFollowed ? (
        <span className="text-[10px] font-bold text-muted-foreground">siguiendo</span>
      ) : (
        <button
          onClick={onFollow}
          className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground transition-opacity hover:opacity-85"
        >
          Seguir
        </button>
      )}
    </div>
  )
}
