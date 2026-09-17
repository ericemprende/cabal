'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Crown, Info, Shield, ShieldCheck, Target, TrendingUp, Wrench, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PointsPill, UserAvatar } from '@/components/cabal/shared'
import { fmtMc, fmtPct } from '@/lib/cabal'
import { useFollowToggle, useLeaderboard } from '@/lib/api-client'
import { useIsOnline } from '@/lib/presence'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CALL_PERIODS, LOSS_MULTIPLE, LOSS_POINTS, SCORE_TIERS, WIN_MULTIPLE, fmtMultiple, type CallPeriod } from '@/lib/call-score'
import type { LeaderboardEntryDTO } from '@/lib/types'

type Board = 'callers' | 'devs' | 'points' | 'clans'

export function LeaderboardTab() {
  const [period, setPeriod] = useState<CallPeriod>('7d')
  const { data, isLoading } = useLeaderboard(period)
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

      {/* Periodo: solo cambia Top Callers (calls publicadas dentro del periodo) */}
      {board === 'callers' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#121410] p-0.5" role="tablist" aria-label="Periodo">
            {CALL_PERIODS.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={period === p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-bold transition-colors',
                  period === p.key ? 'bg-[#8FA83F]/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <ScoreHelp />
        </div>
      )}

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
          {board === 'callers' && data?.callers.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
              <Target className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm font-semibold">Nadie tiene calls con resultado en este periodo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Publica una call con el CA del token en el Feed: su resultado se calcula en unos minutos.
              </p>
            </div>
          )}
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
  const online = useIsOnline(user.id)

  return (
    <div className="card-surface flex items-center gap-3 rounded-xl border border-white/8 p-3 transition-colors hover:border-white/12">
      <span className={cn('w-8 shrink-0 text-center font-machina text-sm font-bold', rank <= 3 ? 'text-primary' : 'text-muted-foreground')}>
        {String(rank).padStart(2, '0')}
      </span>
      <Link href={`/u/${user.handle}`} className="shrink-0" aria-label={`Perfil de @${user.handle}`}>
        <UserAvatar name={user.name} handle={user.handle} src={user.avatar} size="md" verified={user.walletVerified} online={online} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${user.handle}`} className="block hover:underline">
          <p className="flex items-center gap-1.5 truncate text-sm font-bold">
            {user.name}
            {user.isDev && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
            {rank === 1 && <Crown className="h-3.5 w-3.5 text-amber-300" />}
          </p>
          <p className="truncate text-xs text-muted-foreground">@{user.handle}</p>
        </Link>
        {board === 'callers' && entry.calls && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="h-1 w-20 overflow-hidden rounded-full bg-[#8FA83F]/8">
              <div className="h-full rounded-full bg-gradient-to-r from-[#8FA83F]/50 to-[#8FA83F]" style={{ width: `${entry.calls.winRate}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {entry.calls.wins}/{entry.calls.calls} aciertos · {entry.calls.winRate}%
            </span>
            <span className="text-[10px] font-semibold text-amber-300/90">mejor {fmtMultiple(entry.calls.bestMultiple)}</span>
          </div>
        )}
        {/* win rate bar for devs */}
        {board === 'devs' && (
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
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
          // En móvil no cabe junto al score: se sigue desde el perfil
          <button
            onClick={() => follow.mutate(user.id)}
            className="hidden rounded-full sm:block border border-[#8FA83F]/30 px-3 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-[#8FA83F]/10"
          >
            Seguir
          </button>
        )}
      </div>
    </div>
  )
}

/** Cómo se calcula el Cabal Score de las calls. */
function ScoreHelp() {
  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary">
        <Info className="h-3.5 w-3.5" aria-hidden /> ¿Cómo se calcula?
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 border-white/10 bg-popover p-3 text-xs">
        <p className="font-bold text-foreground">Cabal Score</p>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          Cada call suma puntos según el pico que alcanzó el token después de publicarla (máximo desde la call ÷ precio de entrada).
        </p>
        <ul className="mt-2 space-y-1">
          {SCORE_TIERS.map((t) => (
            <li key={t.min} className="flex justify-between">
              <span>{t.label}</span>
              <span className="font-bold text-primary">+{t.points}</span>
            </li>
          ))}
          <li className="flex justify-between">
            <span>Sin llegar a {WIN_MULTIPLE}X y cae más de {Math.round((1 - LOSS_MULTIPLE) * 100)}%</span>
            <span className="font-bold text-[#ff8080]">{LOSS_POINTS}</span>
          </li>
        </ul>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Acierto = pico de {WIN_MULTIPLE}X o más. Los resultados se actualizan cada pocos minutos y quedan fijos a los 30 días.
        </p>
      </PopoverContent>
    </Popover>
  )
}
