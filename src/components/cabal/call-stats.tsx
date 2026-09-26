'use client'

import { useMemo, useState } from 'react'
import { Award, Clock, Crosshair, LineChart, Medal, Target, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtMc, fmtPct, timeAgo } from '@/lib/cabal'
import { CALL_PERIODS, WIN_MULTIPLE, fmtMultiple, type CallPeriod } from '@/lib/call-score'
import { NetworkBadge, TokenGlyph } from '@/components/cabal/shared'
import { CallShareDialog } from '@/components/cabal/post-card'
import { useUserCallStats } from '@/lib/api-client'
import type { CallRowDTO } from '@/lib/types'

type Sort = 'recent' | 'best'

/**
 * Estadísticas públicas de las calls de un usuario: resumen del periodo,
 * posición en Top Callers, sus mejores calls y el historial completo.
 */
export function CallStats({ handle }: { handle: string }) {
  const [period, setPeriod] = useState<CallPeriod>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [showAll, setShowAll] = useState(false)
  const [shareId, setShareId] = useState<string | null>(null)
  const { data, isPending } = useUserCallStats(handle, period)

  const history = useMemo(() => {
    const list = [...(data?.calls ?? [])]
    if (sort === 'best') list.sort((a, b) => (b.peakMultiple ?? -1) - (a.peakMultiple ?? -1))
    return list
  }, [data?.calls, sort])
  const visible = showAll ? history : history.slice(0, 10)
  const s = data?.summary

  return (
    <section className="card-surface space-y-4 rounded-2xl border border-white/10 p-4 sm:p-5" aria-label="Estadísticas de calls">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-base font-bold">
          <Crosshair className="h-4 w-4 text-primary" aria-hidden /> Estadísticas de calls
        </h2>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#0a0b08] p-0.5 sm:ml-auto" role="tablist" aria-label="Periodo">
          {CALL_PERIODS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={period === p.key}
              onClick={() => {
                setPeriod(p.key)
                setShowAll(false)
              }}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors',
                period === p.key ? 'bg-[#8FA83F]/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile icon={Trophy} label="Cabal Score" value={s ? s.score.toLocaleString('es') : '—'} loading={isPending} />
        <Tile icon={Medal} label="Ranking" value={data?.rank ? `#${data.rank}` : '—'} hint="Top Callers" loading={isPending} />
        <Tile icon={Target} label="Calls" value={s ? String(s.calls) : '—'} hint={data?.pending ? `+${data.pending} calculando` : undefined} loading={isPending} />
        <Tile
          icon={Award}
          label="Aciertos"
          value={s && s.calls ? `${s.winRate}%` : '—'}
          hint={s && s.calls ? `${s.wins} de ${s.calls} · ≥${WIN_MULTIPLE}X` : `pico ≥ ${WIN_MULTIPLE}X`}
          loading={isPending}
        />
        <Tile icon={LineChart} label="Pico promedio" value={fmtMultiple(s?.avgPeak)} loading={isPending} />
        <Tile icon={Trophy} label="Mejor call" value={fmtMultiple(s?.bestMultiple)} accent loading={isPending} />
      </div>

      {/* Mejores calls */}
      {data && data.best.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Mejores calls</p>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {data.best.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setShareId(c.id)}
                title="Ver la tarjeta del resultado y compartirla"
                className="w-[150px] shrink-0 rounded-xl border border-white/10 bg-[#0a0b08] p-3 text-left transition-colors hover:border-[#8FA83F]/40"
              >
                <div className="flex items-center gap-2">
                  <TokenGlyph src={c.image} ticker={c.symbol ?? '?'} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold">{c.symbol ? `$${c.symbol}` : 'Token'}</p>
                    <p className="text-[10px] text-muted-foreground">#{i + 1} · {timeAgo(c.createdAt)}</p>
                  </div>
                </div>
                {(() => {
                  const h = callHeadline(c)
                  return (
                    <>
                      <p className={cn('mt-2 font-mono text-xl font-bold', h.tone)}>{h.text}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {!h.showsPeak && `pico ${fmtMultiple(c.peakMultiple)} · `}
                        {c.entryMc ? `desde ${fmtMc(c.entryMc)} MC` : 'desde la call'}
                      </p>
                      {/* Llegó a acierto pero ahora pierde: que se vea, sin quitarle el pico */}
                      {h.showsPeak && c.currentMultiple !== null && c.currentMultiple < 1 && (
                        <p className="truncate text-[10px] font-bold text-[#ff8080]">
                          ahora {fmtPct((c.currentMultiple - 1) * 100)}
                        </p>
                      )}
                    </>
                  )
                })()}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* La tarjeta del resultado: se abre tanto desde "Mejores calls" como desde el historial */}
      <CallShareDialog postId={shareId ?? ''} handle={handle} open={!!shareId} onOpenChange={(v) => !v && setShareId(null)} />

      {/* Historial */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Historial</p>
          <div className="ml-auto flex gap-1">
            {(['recent', 'best'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                  sort === k ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground'
                )}
              >
                {k === 'recent' ? 'Recientes' : 'Más X'}
              </button>
            ))}
          </div>
        </div>

        {isPending ? (
          <div className="space-y-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[#0a0b08]" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-muted-foreground">
            Sin calls en este periodo
          </p>
        ) : (
          <div className="space-y-1.5">
            {visible.map((c) => (
              <CallRow key={c.id} call={c} onOpen={() => setShareId(c.id)} />
            ))}
            {history.length > 10 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full rounded-lg py-2 text-xs font-semibold text-primary hover:bg-white/5"
              >
                {showAll ? 'Ver menos' : `Ver las ${history.length} calls`}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  loading,
}: {
  icon: typeof Trophy
  label: string
  value: string
  hint?: string
  accent?: boolean
  loading?: boolean
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <p className="flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0 text-primary/70" aria-hidden /> {label}
      </p>
      {loading ? (
        <div className="mt-1.5 h-6 w-14 animate-pulse rounded bg-white/5" />
      ) : (
        <p className={cn('mt-1 truncate text-lg font-bold tabular-nums', accent && 'text-amber-300')}>{value}</p>
      )}
      {hint && !loading && <p className="truncate text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * Cifra principal de una call. Si llegó a acierto (pico ≥ 1.5X) se enseña el
 * pico en verde; si no, cómo va ahora en % (rojo si pierde). Así una call que
 * nunca subió no sale como "1.00X" en verde cuando va en -47%: la misma idea
 * que la tarjeta de compartir.
 */
function callHeadline(c: { peakMultiple: number | null; currentMultiple: number | null }): {
  text: string
  tone: string
  showsPeak: boolean
} {
  if (c.peakMultiple !== null && c.peakMultiple >= WIN_MULTIPLE) {
    return { text: fmtMultiple(c.peakMultiple), tone: 'text-primary', showsPeak: true }
  }
  if (c.currentMultiple === null) return { text: fmtMultiple(c.peakMultiple), tone: 'text-foreground/80', showsPeak: true }
  const pct = (c.currentMultiple - 1) * 100
  return {
    text: fmtPct(pct),
    tone: pct < 0 ? 'text-[#ff8080]' : pct > 0 ? 'text-primary' : 'text-foreground/80',
    showsPeak: false,
  }
}

function CallRow({ call, onOpen }: { call: CallRowDTO; onOpen: () => void }) {
  const evaluated = call.peakMultiple !== null
  const h = callHeadline(call)
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Ver la tarjeta del resultado y compartirla"
      className="flex w-full items-center gap-2.5 rounded-xl border border-white/8 bg-[#0a0b08] p-2.5 text-left transition-colors hover:border-[#8FA83F]/40"
    >
      <TokenGlyph src={call.image} ticker={call.symbol ?? '?'} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[13px] font-bold">{call.symbol ? `$${call.symbol}` : `${call.contract.slice(0, 6)}…`}</p>
          <NetworkBadge network={call.network} className="shrink-0" />
        </div>
        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          {timeAgo(call.createdAt)}
          {call.entryMc ? ` · entrada ${fmtMc(call.entryMc)}` : ''}
          {call.final ? ' · cerrada' : ''}
        </p>
      </div>
      {evaluated ? (
        <div className="shrink-0 text-right">
          <p className={cn('font-mono text-sm font-bold', h.tone)}>
            {h.text} <span className="text-[10px] font-normal text-muted-foreground">{h.showsPeak ? 'pico' : 'ahora'}</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            {h.showsPeak ? `ahora ${fmtMultiple(call.currentMultiple)}` : `pico ${fmtMultiple(call.peakMultiple)}`} ·{' '}
            <span className={cn('font-bold', call.points > 0 ? 'text-primary' : call.points < 0 ? 'text-[#ff8080]' : '')}>
              {call.points > 0 ? `+${call.points}` : call.points} pts
            </span>
          </p>
        </div>
      ) : (
        <span className="shrink-0 text-[11px] text-muted-foreground">calculando…</span>
      )}
    </button>
  )
}
