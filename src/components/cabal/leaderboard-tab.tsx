'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Crown, Info, Send, Shield, ShieldCheck, Target, Users, Wrench, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Chapa } from '@/components/cabal/chapa'
import type { Silueta } from '@/lib/siluetas'
import { PointsPill, UserAvatar, OfficialBadge } from '@/components/cabal/shared'
import { DiscordLogo } from '@/components/cabal/discord-logo'
import { useFollowToggle, useLeaderboard } from '@/lib/api-client'
import { useIsOnline } from '@/lib/presence'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CALL_PERIODS, LOSS_MULTIPLE, LOSS_POINTS, SCORE_TIERS, WIN_MULTIPLE, fmtMultiple, type CallPeriod } from '@/lib/call-score'
import type { ClanDTO, CommunityDTO, LeaderboardEntryDTO } from '@/lib/types'

type Board = 'callers' | 'devs' | 'points' | 'clans'

/**
 * Filtra Top Callers por comunidad: los grupos de Telegram y servidores de
 * Discord donde está el bot. Solo aparecen los que ya han dado alguna call,
 * así que en una instalación nueva este selector no se ve.
 */
function CommunityPicker({
  communities,
  value,
  onChange,
}: {
  communities: CommunityDTO[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
      <Users className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Comunidad</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-full border border-white/10 bg-[#121410] px-2.5 py-1 text-[11px] font-bold text-foreground"
      >
        <option value="">Todo Cabal</option>
        {communities.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label} ({c.calls})
          </option>
        ))}
      </select>
    </label>
  )
}

export function LeaderboardTab() {
  const [period, setPeriod] = useState<CallPeriod>('7d')
  // null = todo Cabal; una clave = solo las calls nacidas en ese grupo/servidor
  const [community, setCommunity] = useState<string | null>(null)
  const { data, isLoading } = useLeaderboard(period, community)
  const [board, setBoard] = useState<Board>('callers')

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {(
          [
            { key: 'callers', label: 'Top Callers', silueta: 'target-arrows' as const },
            { key: 'points', label: 'Puntos Cabal', silueta: 'star-medal' as const },
            { key: 'devs', label: 'Devs', silueta: 'anvil-impact' as const },
            { key: 'clans', label: 'Clanes', silueta: 'winged-emblem' as const },
          ] as { key: Board; label: string; silueta: Silueta }[]
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
            <Chapa silueta={b.silueta} metal="acero" className="h-5 w-5" placa />
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
          {!!data?.communities.length && (
            <CommunityPicker
              communities={data.communities}
              value={community}
              onChange={setCommunity}
            />
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-white/8 bg-[#121410]" />
          ))}
        </div>
      ) : board === 'clans' ? (
        <ClanBoard
          clans={data?.clans ?? []}
          onOpenCommunity={(key) => {
            setCommunity(key)
            setBoard('callers')
          }}
        />
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

/**
 * Clanes = las comunidades de Telegram y Discord que ya usan el bot. Nadie
 * crea un clan dentro de Cabal: se trae el grupo o servidor que ya existe, y
 * desde aquí cualquiera puede entrar con su enlace.
 */
function ClanBoard({ clans, onOpenCommunity }: { clans: ClanDTO[]; onOpenCommunity: (key: string) => void }) {
  if (clans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
        <Shield className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
        <p className="mt-2 text-sm font-semibold">Todavía no hay comunidades con el bot</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Un clan es tu grupo de Telegram o tu servidor de Discord, tal cual: añade el bot de Cabal y las calls que deis
          allí puntúan aquí.{' '}
          <a href="/bot" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
            Cómo añadirlo
          </a>
        </p>
      </div>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {clans.map((c, i) => (
        <div key={c.key} className="card-surface flex flex-col gap-3 rounded-xl border border-white/10 p-4">
          <div className="flex items-start gap-3">
<ClanAvatar clan={c} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold">
                #{i + 1} {c.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {c.provider === 'telegram' ? 'Telegram' : 'Discord'}
                {c.members !== null && ` · ${c.members.toLocaleString('es')} miembros`}
                {c.online !== null && ` · ${c.online.toLocaleString('es')} en línea`}
                {c.callers > 0 && ` · ${c.callers} caller${c.callers === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-primary">{c.score} pts</p>
              <p className="text-[11px] text-muted-foreground">Cabal Score</p>
            </div>
          </div>

          {/*
            Cuántos de esta comunidad tienen cuenta en Cabal: el radar y el
            número, sin el total del grupo al lado. Si ninguno la tiene todavía
            no se enseña nada, que un cero no dice nada bueno de nadie.
          */}
          {c.cabalMembers !== null && c.cabalMembers > 0 && (
            <p
              className="flex w-fit items-center gap-1.5 rounded-lg border border-[#8FA83F]/20 bg-[#8FA83F]/8 px-2 py-1 text-[11px]"
              title={`${c.cabalMembers.toLocaleString('es')} ${c.cabalMembers === 1 ? 'miembro tiene' : 'miembros tienen'} cuenta en Cabal`}
            >
              <img src="/cabal-logo.webp" alt="" className="h-3.5 w-3.5 shrink-0 object-contain" aria-hidden />
              <span className="font-bold text-primary">{c.cabalMembers.toLocaleString('es')}</span>
              <span className="sr-only">en Cabal</span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Calls" value={String(c.calls)} />
            <Stat label="Aciertos" value={c.calls > 0 ? `${c.winRate}%` : '—'} hint={c.calls > 0 ? `${c.wins} de ${c.calls}` : undefined} />
            <Stat label="Mejor call" value={fmtMultiple(c.bestMultiple)} accent={(c.bestMultiple ?? 0) >= WIN_MULTIPLE} />
          </div>

          {c.topCallers.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sus mejores callers</p>
              {c.topCallers.map((u) => (
                <Link
                  key={u.handle}
                  href={`/u/${u.handle}`}
                  className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-white/5"
                >
                  <UserAvatar name={u.name} handle={u.handle} src={u.avatar} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{u.name}</span>
                  <span className="shrink-0 font-mono text-[11px] font-bold text-primary">{fmtMultiple(u.bestMultiple)}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenCommunity(c.key)}
              className="flex-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-bold text-foreground/90 transition-colors hover:border-[#8FA83F]/40 hover:text-primary"
            >
              Ver sus callers
            </button>
            {c.link && (
              <a
                href={c.link}
                target="_blank"
                rel="noreferrer"
                aria-label={`Unirme a ${c.name} en ${c.provider === 'telegram' ? 'Telegram' : 'Discord'}`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/90 px-2 py-1.5 text-[11px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {/* El icono dice a dónde te llevas: al grupo o al servidor */}
                {c.provider === 'telegram' ? (
                  <Send className="h-3 w-3" aria-hidden />
                ) : (
                  <DiscordLogo className="h-3 w-3" />
                )}
                Unirme
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Foto de la comunidad con el sello de Telegram o Discord; sin foto, el icono del proveedor. */
function ClanAvatar({ clan }: { clan: ClanDTO }) {
  const [broken, setBroken] = useState(false)
  const telegram = clan.provider === 'telegram'
  const Icon = telegram ? Send : DiscordLogo
  return (
    <span className="relative h-11 w-11 shrink-0">
      {clan.image && !broken ? (
        <img
          src={clan.image}
          alt={`Logo de ${clan.name}`}
          width={44}
          height={44}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-11 w-11 rounded-lg border border-white/10 object-cover"
        />
      ) : (
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-lg border',
            telegram ? 'border-[#229ED9]/30 bg-[#229ED9]/10 text-[#5cc0f0]' : 'border-[#5865F2]/30 bg-[#5865F2]/10 text-[#98a2fa]'
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span
        className={cn(
          'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-[#0a0b08]',
          telegram ? 'bg-[#229ED9] text-white' : 'bg-[#5865F2] text-white'
        )}
        title={telegram ? 'Telegram' : 'Discord'}
      >
        <Icon className="h-2.5 w-2.5" aria-label={telegram ? 'Telegram' : 'Discord'} />
      </span>
    </span>
  )
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0a0b08] px-2 py-1.5">
      <p className={cn('font-mono text-[13px] font-bold', accent ? 'text-primary' : 'text-foreground/90')}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint ?? label}</p>
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
        <UserAvatar name={user.name} handle={user.handle} src={user.avatar} size="md" verified={user.walletVerified} official={user.verified} online={online} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${user.handle}`} className="block hover:underline">
          <p className="flex items-center gap-1.5 truncate text-sm font-bold">
            {user.name}
            {user.verified && <OfficialBadge />}
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
