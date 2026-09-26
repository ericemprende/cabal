'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Coins, EyeOff, Hash, LineChart, Lock, Scale, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { networkMeta, timeAgo } from '@/lib/cabal'
import { NetworkIcon } from '@/components/cabal/shared'
import { useTrackRecord } from '@/lib/api-client'

const DAY = 86_400_000
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a)

function fmtUsd(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: abs < 100 ? 2 : 0 })}`
}

const signed = (n: number) => (n > 0 ? `+${fmtUsd(n)}` : fmtUsd(n))
const tone = (n: number) => (n > 0 ? 'text-primary' : n < 0 ? 'text-[#ff8080]' : 'text-foreground/80')

/** Primer y último día (UTC) del mes "yyyy-mm". */
function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number)
  return { from: isoDay(new Date(Date.UTC(y, m - 1, 1))), to: isoDay(new Date(Date.UTC(y, m, 0))) }
}

/**
 * Track record de trading en el perfil: las compras y ventas hechas desde
 * Cabal con las wallets vinculadas del usuario, con filtro de fechas y de
 * wallet. Solo se ve si el usuario lo hizo público (o si es el propio dueño).
 */
export function TrackRecord({ handle }: { handle: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [wallet, setWallet] = useState('')
  const q = useTrackRecord(handle, { from, to, wallet })
  const d = q.data

  // Ni público ni propio: la sección no aparece.
  if (!d || !d.visible) return null

  const today = isoDay(new Date())
  const presets: [string, string, string][] = [
    ['Todo', '', ''],
    ['7 días', isoDay(new Date(Date.now() - 6 * DAY)), today],
    ['30 días', isoDay(new Date(Date.now() - 29 * DAY)), today],
    ['Este mes', monthRange(today.slice(0, 7)).from, monthRange(today.slice(0, 7)).to],
    ['90 días', isoDay(new Date(Date.now() - 89 * DAY)), today],
  ]
  const s = d.summary

  return (
    <section className="card-surface space-y-4 rounded-2xl border border-white/10 p-4 sm:p-5" aria-label="Track record">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-base font-bold">
          <LineChart className="h-4 w-4 text-primary" aria-hidden /> Track record
        </h2>
        <span className="text-[11px] text-muted-foreground">operaciones hechas desde Cabal</span>
        {d.isMe && !d.public && (
          <span className="flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 sm:ml-auto">
            <EyeOff className="h-3 w-3" aria-hidden /> Solo tú lo ves · actívalo en Editar perfil
          </span>
        )}
      </div>

      {/* Filtros: periodo y wallet */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-[#0a0b08] p-0.5">
          {presets.map(([label, f, t]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setFrom(f)
                setTo(t)
              }}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors',
                from === f && to === t ? 'bg-[#8FA83F]/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
          Desde
          <input
            type="date"
            value={from}
            max={to || today}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-[#0a0b08] px-2 text-xs text-foreground [color-scheme:dark]"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
          Hasta
          <input
            type="date"
            value={to}
            min={from || undefined}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-[#0a0b08] px-2 text-xs text-foreground [color-scheme:dark]"
          />
        </label>
        {d.wallets.length > 1 && (
          <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
            Wallet
            <select
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="h-8 rounded-lg border border-white/10 bg-[#0a0b08] px-2 text-xs text-foreground [color-scheme:dark]"
            >
              <option value="">Todas ({d.wallets.length})</option>
              {d.wallets.map((w) => (
                <option key={`${w.network}:${w.address}`} value={w.address}>
                  {networkMeta(w.network).label} · {short(w.address)}
                </option>
              ))}
            </select>
          </label>
        )}
        {q.isFetching && <span className="pb-2 text-[11px] text-muted-foreground">Cargando…</span>}
      </div>

      {d.wallets.length === 0 ? (
        <p className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Sin wallets vinculadas todavía
        </p>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Tile icon={Coins} label="Volumen" value={fmtUsd(s.volumeUsd)} hint={`${s.trades} operaciones`} />
            <Tile icon={ArrowDownRight} label="Compras" value={fmtUsd(s.buyUsd)} hint={`${s.buys} ops`} />
            <Tile icon={ArrowUpRight} label="Ventas" value={fmtUsd(s.sellUsd)} hint={`${s.sells} ops`} />
            <Tile
              icon={Scale}
              label="Flujo neto"
              value={signed(s.netUsd)}
              valueClass={tone(s.netUsd)}
              hint="ventas − compras"
            />
            <Tile icon={Hash} label="Tokens" value={String(s.tokens)} hint="distintos" />
            <Tile icon={Coins} label="Ticket medio" value={fmtUsd(s.avgTradeUsd)} hint={`mayor ${fmtUsd(s.largestTradeUsd)}`} />
          </div>

          {s.trades === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-muted-foreground">
              Sin operaciones desde Cabal en este periodo
            </p>
          ) : (
            <>
              {/* Volumen diario: compras y ventas */}
              {d.series.length > 1 && (
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.series} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                      <CartesianGrid stroke="rgba(143,168,63,0.07)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v: string) => v.slice(5)}
                        tick={{ fill: '#8b917f', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fill: '#8b917f', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                      <Tooltip
                        cursor={{ fill: 'rgba(143,168,63,0.08)' }}
                        contentStyle={{ background: '#121410', border: '1px solid rgba(143,168,63,0.25)', borderRadius: 10, fontSize: 12 }}
                        formatter={(v: number, name: string) => [fmtUsd(v), name === 'buyUsd' ? 'Compras' : 'Ventas']}
                      />
                      <Bar dataKey="buyUsd" stackId="v" fill="#8FA83F" />
                      <Bar dataKey="sellUsd" stackId="v" fill="#ff8080" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Por token */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Por token</p>
                  <div className="space-y-1.5">
                    {d.tokens.slice(0, 12).map((t) => (
                      <div key={`${t.network}:${t.mint}`} className="flex items-center gap-2 rounded-xl border border-white/8 bg-[#0a0b08] px-2.5 py-2 text-xs">
                        <NetworkIcon network={t.network} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{t.symbol ? `$${t.symbol}` : short(t.mint)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {t.trades} ops · compró {fmtUsd(t.buyUsd)} · vendió {fmtUsd(t.sellUsd)}
                          </p>
                        </div>
                        <span className={cn('shrink-0 font-mono font-bold tabular-nums', tone(t.netUsd))}>{signed(t.netUsd)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Por wallet */}
                  {d.wallets.length > 1 && !wallet && (
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Por wallet</p>
                      <div className="space-y-1.5">
                        {d.wallets.map((w) => (
                          <button
                            key={`${w.network}:${w.address}`}
                            type="button"
                            onClick={() => setWallet(w.address)}
                            className="flex w-full items-center gap-2 rounded-xl border border-white/8 bg-[#0a0b08] px-2.5 py-2 text-left text-xs transition-colors hover:border-[#8FA83F]/40"
                          >
                            <Wallet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <NetworkIcon network={w.network} />
                            <span className="min-w-0 flex-1 truncate font-mono">{short(w.address)}</span>
                            <span className="shrink-0 text-muted-foreground">{w.trades} ops · {fmtUsd(w.volumeUsd)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Últimas operaciones */}
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Últimas operaciones</p>
                    <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                      {d.recent.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#0a0b08] px-2.5 py-1.5 text-[11px]">
                          <NetworkIcon network={r.network} />
                          <span className={cn('font-semibold', r.kind === 'buy' ? 'text-primary' : 'text-[#ff8080]')}>
                            {r.kind === 'buy' ? 'Compra' : 'Venta'}
                          </span>
                          <span className="truncate font-bold">{r.symbol ? `$${r.symbol}` : short(r.mint)}</span>
                          <span className="tabular-nums text-foreground/80">{fmtUsd(r.amountUsd)}</span>
                          <span className="ml-auto shrink-0 text-muted-foreground">{timeAgo(r.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Solo cuenta las compras y ventas hechas desde Cabal y confirmadas on-chain, en USD al momento de cada
            operación. El flujo neto no incluye lo que siga en cartera. Fechas en hora UTC.
          </p>
        </>
      )}
    </section>
  )
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  valueClass,
}: {
  icon: typeof Coins
  label: string
  value: string
  hint?: string
  valueClass?: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <p className="flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0 text-primary/70" aria-hidden /> {label}
      </p>
      <p className={cn('mt-1 truncate text-lg font-bold tabular-nums', valueClass)}>{value}</p>
      {hint && <p className="truncate text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
