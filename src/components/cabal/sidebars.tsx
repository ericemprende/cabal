'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Crown, MessageCircle, MessageSquare, Radio, Rocket, Timer, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { Button } from '@/components/ui/button'
import { CountdownPill, NetworkBadge, PointsPill, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { LaunchActivityCard, useActivity } from '@/components/cabal/launch-activity'
import { useFollowToggle, useLaunches, useLeaderboard, usePointRules } from '@/lib/api-client'
import { useGoToTab } from '@/lib/use-go-to-tab'
import { useUI } from '@/lib/store'
import { useIsOnline, useOnlineCount, useOnlineMembers } from '@/lib/presence'
import { LiveChat } from '@/components/cabal/live-chat'
import { useChatUnread } from '@/lib/chat-unread'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fmtNum } from '@/lib/cabal'
import { fmtMultiple } from '@/lib/call-score'

type ActivityFilter = 'all' | 'launch' | 'post' | 'chat'

const ACTIVITY_FILTERS: { value: ActivityFilter; icon: typeof Radio }[] = [
  { value: 'all', icon: Radio },
  { value: 'launch', icon: Rocket },
  { value: 'post', icon: MessageSquare },
  { value: 'chat', icon: MessageCircle },
]

/** Lista de quién está conectado ahora mismo, para el tooltip del icono del chat. */
function OnlineTooltipContent() {
  const t = useT()
  const members = useOnlineMembers()
  if (members.length === 0) return <p className="text-xs">{t.activity.nobodyOnline}</p>
  return (
    <div className="max-w-[220px] space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {t.activity.onlineCount(members.length)}
      </p>
      <div className="space-y-1">
        {members.slice(0, 8).map((m) => (
          <div key={m.id} className="flex items-center gap-1.5">
            <UserAvatar name={m.name} handle={m.handle} src={m.avatar} size="xs" online />
            <span className="truncate text-xs">{m.name}</span>
          </div>
        ))}
        {members.length > 8 && (
          <p className="text-[10px] text-muted-foreground">{t.activity.more(members.length - 8)}</p>
        )}
      </div>
    </div>
  )
}

// ---------- Left: live activity ----------

/**
 * La Actividad del Cabal: el filtro y la lista. Vive en la columna lateral del
 * escritorio y, desde el botón flotante de Actividad, también en el móvil.
 *
 * `withChat` decide si el Chat es una pestaña más del filtro. En escritorio sí:
 * su sitio es el costado, junto a la actividad, no la barra de secciones. En el
 * móvil no, porque allí el Chat tiene su propio botón y repetirlo confunde.
 */
export function ActivityStream({ withChat = true }: { withChat?: boolean }) {
  const t = useT()
  const { items: activity, isLoading } = useActivity(30)
  const { openLaunch } = useUI()
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const onlineCount = useOnlineCount()
  const unread = useChatUnread()
  const unreadLabel = unread > 99 ? '99+' : String(unread)
  const filters = withChat ? ACTIVITY_FILTERS : ACTIVITY_FILTERS.filter((f) => f.value !== 'chat')

  const filtered = useMemo(
    () => (filter === 'all' ? activity : activity.filter((item) => item.type === filter)),
    [activity, filter]
  )

  return (
    <div id="cabal-activity-panel">
      {/* Filtro por tipo de actividad */}
      <div className="mb-3 flex items-center gap-1 px-1" role="tablist" aria-label={t.activity.filter}>
        {filters.map(({ value, icon: Icon }) =>
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
                  {t.activity.filters[value]}
                  {unread > 0 && filter !== 'chat' ? (
                    <span
                      className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400 px-1 text-[9px] font-bold leading-none text-[#0a0b08]"
                      aria-label={t.activity.unread(unreadLabel)}
                    >
                      {unreadLabel}
                    </span>
                  ) : (
                    onlineCount > 0 && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
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
              {t.activity.filters[value]}
            </button>
          )
        )}
      </div>

      {filter === 'chat' ? (
        // Ocupa el alto del costado (pantalla menos header y filtros)
        <LiveChat className="h-[calc(100vh-190px)] min-h-[420px]" />
      ) : (
        <div className="space-y-2">
          {isLoading &&
            [...Array(6)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[#121410]" />)}
          {!isLoading && filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-muted-foreground">
              {t.activity.empty}
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
  )
}

export function LeftFeed() {
  const t = useT()
  const onlineCount = useOnlineCount()
  const unread = useChatUnread()
  const unreadLabel = unread > 99 ? '99+' : String(unread)
  // Colapsable hacia la izquierda: en vez de solo ocultar el contenido, el
  // panel se encoge a una tira angosta y el feed del medio gana ese ancho
  // (es flex-1 en el layout, así que crece solo).
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn('hidden shrink-0 transition-[width] duration-200 lg:block', collapsed ? 'w-11' : 'w-[440px] 2xl:w-[500px]')}
      aria-label={t.activity.live}
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
          title={collapsed ? t.activity.show : t.activity.hide}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          ) : (
            <>
              <Radio className="h-3.5 w-3.5 text-primary live-dot" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t.activity.title}</p>
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
                aria-label={t.activity.chatAria(onlineCount, unread ? unreadLabel : '')}
              >
                <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400 px-1 text-[9px] font-bold leading-none text-[#0a0b08]">
                    {unreadLabel}
                  </span>
                ) : onlineCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#0a0b08] bg-emerald-400" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <OnlineTooltipContent />
            </TooltipContent>
          </Tooltip>
        )}

        {!collapsed && <ActivityStream />}
      </div>
    </aside>
  )
}

// ---------- Right: next launches + top callers ----------
export function RightRail() {
  const t = useT()
  const { data: launches } = useLaunches()
  const { data: leaderboard } = useLeaderboard()
  const follow = useFollowToggle()
  const rules = usePointRules()
  const router = useRouter()
  const goToTab = useGoToTab()
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
    <aside className="hidden w-[290px] shrink-0 xl:block" aria-label={t.rail.aria}>
      <div className="sticky top-[72px] max-h-[calc(100vh-140px)] space-y-4 overflow-y-auto pl-1">
        {/* Next launches */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <Timer className="h-3.5 w-3.5" aria-hidden /> {t.rail.upcoming}
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
                      <span className="text-amber-300/90">{t.notifications.private}</span>
                    ) : (
                      l.ticker
                    )}{' '}
                    <span className="font-normal text-muted-foreground">· {l.name}</span>
                  </p>
                  <div className="mt-0.5"><NetworkBadge network={l.network} /></div>
                </div>
                <CountdownPill target={l.launchAt} size="sm" estimated={!l.dateConfirmed} awaitingContract={!l.contract} />
              </button>
            ))}
            {next.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-muted-foreground">
                {t.rail.radarClear}
              </p>
            )}
          </div>
        </section>

        {/* Top callers */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <Crown className="h-3.5 w-3.5 text-amber-300/80" aria-hidden /> {t.rail.topCabal}
          </p>
          <div className="card-surface space-y-0.5 rounded-xl border border-white/10 p-1.5">
            {top.map((c, i) => (
              <TopCallerRow key={c.user.id} caller={c} rank={i} onFollow={() => follow.mutate(c.user.id)} />
            ))}
            {top.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {t.rail.noCalls}
              </p>
            )}
          </div>
        </section>

        {/* Crear token: abre la pestaña de lanzamiento de /app */}
        <section className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-transparent p-4">
          <p className="flex items-center gap-1.5 font-display text-sm font-bold text-amber-300">
            <Rocket className="h-4 w-4" aria-hidden /> {t.rail.createTitle}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground/75">
            {t.rail.createBody}
          </p>
          <Button
            size="sm"
            onClick={() => goToTab('launch')}
            className="mt-2.5 w-full bg-amber-400 font-bold text-black hover:bg-amber-300"
          >
            {t.rail.createCta}
          </Button>
        </section>

        {/* El crédito de las siluetas de las insignias (CC BY) vive en /creditos
            y tiene que estar enlazado desde donde se ven, no solo en la landing. */}
        <nav className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground" aria-label={t.rail.legalNav}>
          <Link href="/terminos" className="hover:text-foreground">
            {t.rail.terms}
          </Link>
          <Link href="/privacidad" className="hover:text-foreground">
            {t.rail.privacy}
          </Link>
          <Link href="/creditos" className="hover:text-foreground">
            {t.rail.credits}
          </Link>
        </nav>
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
  const t = useT()
  const online = useIsOnline(caller.user.id)
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/5">
      <span className={cn('w-4 text-center text-[11px] font-bold', rank === 0 ? 'text-amber-300' : 'text-muted-foreground')}>
        {rank + 1}
      </span>
      <Link href={`/u/${caller.user.handle}`} className="flex min-w-0 flex-1 items-center gap-2.5">
        <UserAvatar name={caller.user.name} handle={caller.user.handle} src={caller.user.avatar} size="xs" verified={caller.user.walletVerified} official={caller.user.verified} online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{caller.user.name}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {caller.calls
              ? t.rail.callerLine(caller.calls.score, fmtMultiple(caller.calls.bestMultiple))
              : t.rail.followers(fmtNum(caller.user.followers))}
          </p>
        </div>
      </Link>
      {caller.user.isFollowed ? (
        <span className="text-[10px] font-bold text-muted-foreground">{t.rail.following}</span>
      ) : (
        <button
          onClick={onFollow}
          className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground transition-opacity hover:opacity-85"
        >
          {t.rail.follow}
        </button>
      )}
    </div>
  )
}
