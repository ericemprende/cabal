'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Radio, Timer, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CountdownPill, NetworkBadge, PointsPill, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { useFollowToggle, useFeed, useLaunches, useLeaderboard } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { fmtNum } from '@/lib/cabal'

// ---------- Left: live activity ----------
export function LeftFeed() {
  const { data: feed, isLoading } = useFeed()
  const { openLaunch, openToken } = useUI()

  const activity = useMemo(() => {
    // mix of posts (already includes linked targets)
    return (feed ?? []).slice(0, 14)
  }, [feed])

  return (
    <aside className="hidden w-[300px] shrink-0 lg:block" aria-label="Actividad en vivo">
      <div className="sticky top-[72px] max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
        <div className="mb-2 flex items-center gap-2 px-1">
          <Radio className="h-3.5 w-3.5 text-primary live-dot" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Actividad del Cabal</p>
        </div>
        <div className="space-y-2">
          {isLoading &&
            [...Array(6)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[#121410]" />)}
          {activity.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              compact
              onComment={() => {
                if (p.launch) openLaunch(p.launch.id)
                else if (p.token) openToken(p.token.id)
              }}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

// ---------- Right: next launches + top callers ----------
export function RightRail() {
  const { data: launches } = useLaunches()
  const { data: leaderboard } = useLeaderboard()
  const follow = useFollowToggle()
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
              <Zap className="h-3 w-3" aria-hidden /> +40
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
                <CountdownPill target={l.launchAt} size="sm" />
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
              <div key={c.user.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/5">
                <span className={cn('w-4 text-center text-[11px] font-bold', i === 0 ? 'text-amber-300' : 'text-muted-foreground')}>
                  {i + 1}
                </span>
                <UserAvatar name={c.user.name} handle={c.user.handle} src={c.user.avatar} size="xs" verified={c.user.walletVerified} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{c.user.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{fmtNum(c.user.followers)} seguidores</p>
                </div>
                {c.user.isFollowed ? (
                  <span className="text-[10px] font-bold text-muted-foreground">siguiendo</span>
                ) : (
                  <button
                    onClick={() => follow.mutate(c.user.id)}
                    className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground transition-opacity hover:opacity-85"
                  >
                    Seguir
                  </button>
                )}
              </div>
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
