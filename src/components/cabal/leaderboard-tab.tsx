'use client'

import { useState } from 'react'
import { Crown, Shield, ShieldCheck, Target, TrendingUp, Wrench, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PointsPill, UserAvatar } from '@/components/cabal/shared'
import { fmtMc, fmtPct } from '@/lib/cabal'
import { useFollowToggle, useLeaderboard } from '@/lib/api-client'
import type { LeaderboardEntryDTO } from '@/lib/types'

type Board = 'callers' | 'devs' | 'points' | 'clans'

export function LeaderboardTab() {
  const { data, isLoading } = useLeaderboard()
  const [board, setBoard] = useState<Board>('callers')

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {(
          [
            { key: 'callers', label: 'Top Callers', icon: Target },
            { key: 'points', label: 'Puntos Cabal', icon: Zap },
            { key: 'devs', label: 'Devs', icon: Wrench },
            { key: 'clans', label: 'Clanes', icon: Shield },
          ] as { key: Board; label: string; icon: typeof Target }[]
        ).map((b) => (
          <button
            key={b.key}
            onClick={() => setBoard(b.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all',
              board === b.key
                ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary neon-shadow'
                : 'border-white/10 bg-[#121410] text-muted-foreground hover:border-[#8FA83F]/30'
            )}
          >
            <b.icon className="h-3.5 w-3.5" aria-hidden />
            {b.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-white/8 bg-[#121410]" />
          ))}
        </div>
      ) : board === 'clans' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data?.clans.map((c, i) => (
            <div key={c.id} className="card-surface flex items-center gap-3 rounded-xl border border-white/10 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400" aria-hidden>
                <Shield className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-display text-sm font-bold">
                  #{i + 1} {c.name}
                  <span className="rounded bg-[#8FA83F]/10 px-1.5 py-px font-mono text-[10px] text-primary">{c.tag}</span>
                </p>
                <p className="text-xs text-muted-foreground">{c.members} miembros</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{fmtMc(c.score)}</p>
                <p className={cn('flex items-center justify-end gap-0.5 text-[11px] font-semibold', c.trend >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
                  <TrendingUp className={cn('h-3 w-3', c.trend < 0 && 'rotate-180')} /> {fmtPct(c.trend)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {(board === 'callers' ? data?.callers : board === 'devs' ? data?.devs : data?.points)?.map((entry) => (
            <Row key={entry.user.id} entry={entry} board={board} />
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ entry, board }: { entry: LeaderboardEntryDTO; board: Board }) {
  const follow = useFollowToggle()
  const { user, rank } = entry
  const winRate = entry.winRate ?? 0

  return (
    <div className="card-surface flex items-center gap-3 rounded-xl border border-white/8 p-3 transition-colors hover:border-white/12">
      <span className={cn('w-8 shrink-0 text-center font-machina text-sm font-bold', rank <= 3 ? 'text-primary' : 'text-muted-foreground')}>
        {String(rank).padStart(2, '0')}
      </span>
      <UserAvatar name={user.name} handle={user.handle} src={user.avatar} size="md" verified={user.walletVerified} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold">
          {user.name}
          {user.isDev && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          {rank === 1 && <Crown className="h-3.5 w-3.5 text-amber-300" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">@{user.handle}</p>
        {/* win rate bar for callers/devs */}
        {(board === 'callers' || board === 'devs') && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-[#8FA83F]/8">
              <div className="h-full rounded-full bg-gradient-to-r from-[#8FA83F]/50 to-[#8FA83F]" style={{ width: `${winRate}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {user.callsWon}/{user.callsTotal} aciertos · {winRate}%
            </span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {board === 'points' && <PointsPill points={entry.metric} />}
        {board === 'callers' && (
          <div className="text-right">
            <p className="text-sm font-bold text-primary">{entry.metric.toLocaleString('es')}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cabal Score</p>
          </div>
        )}
        {board === 'devs' && (
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 text-sm font-bold text-primary">
              <Zap className="h-3 w-3" /> {entry.metric.toLocaleString('es')}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">puntos</p>
          </div>
        )}
        {!user.isFollowed && (
          <button
            onClick={() => follow.mutate(user.id)}
            className="rounded-full border border-[#8FA83F]/30 px-3 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-[#8FA83F]/10"
          >
            Seguir
          </button>
        )}
      </div>
    </div>
  )
}
