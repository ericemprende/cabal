'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bomb, Crown, Heart, Percent, Rocket, Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { jsonFetch } from '@/lib/api-client'
import { timeAgo } from '@/lib/cabal'
import type { RevenueDTO, RevenueSource } from '@/lib/types'

/**
 * /admin → Ingresos: todo lo que genera Cabal en un solo sitio (Premium,
 * munición, donaciones, comisión por crear token y comisión de compra/venta).
 * La configuración de cada fuente sigue en su pestaña; aquí va la foto completa.
 */
const SOURCES: { key: RevenueSource; label: string; color: string; icon: typeof Crown }[] = [
  { key: 'premium', label: 'Suscripciones Premium', color: '#e3b341', icon: Crown },
  { key: 'ammo', label: 'Munición', color: '#ff8a4c', icon: Bomb },
  { key: 'donations', label: 'Donaciones', color: '#ff6b9a', icon: Heart },
  { key: 'launch', label: 'Comisión por crear token', color: '#5cc8ff', icon: Rocket },
  { key: 'swap', label: 'Comisión de compra/venta', color: '#8FA83F', icon: Percent },
]

const usd = (n: number) => `$${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const total = (o: Record<RevenueSource, number>) => SOURCES.reduce((a, s) => a + (o[s.key] ?? 0), 0)
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return { from: `${ym}-01`, to: isoDay(new Date(Date.UTC(y, m, 0))) }
}

export function AdminRevenue({ enabled }: { enabled: boolean }) {
  const today = new Date()
  const [range, setRange] = useState(() => monthRange(isoDay(today).slice(0, 7)))
  const q = useQuery<RevenueDTO>({
    queryKey: ['admin', 'revenue', range.from, range.to],
    queryFn: () => jsonFetch(`/api/admin/revenue?from=${range.from}&to=${range.to}`),
    enabled,
    refetchInterval: 60_000,
  })
  const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
  const presets: [string, { from: string; to: string }][] = [
    ['Este mes', monthRange(isoDay(today).slice(0, 7))],
    ['Mes pasado', monthRange(isoDay(last).slice(0, 7))],
    ['Últimos 30 días', { from: isoDay(new Date(Date.now() - 29 * 86_400_000)), to: isoDay(today) }],
    ['Últimos 7 días', { from: isoDay(new Date(Date.now() - 6 * 86_400_000)), to: isoDay(today) }],
  ]

  if (q.isLoading) return <Skeleton className="h-96 w-full" />
  if (q.isError)
    return (
      <div className="rounded-xl border border-[#ff4d5e]/30 bg-[#0a0b08] p-4 text-xs text-[#ff8080]">
        No se pudieron cargar los ingresos: {q.error.message}
      </div>
    )
  const d = q.data
  if (!d) return null
  const rangeTotal = total(d.range.bySource)

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Todo lo que ingresa Cabal, junto y en dólares. Premium, munición y donaciones son cobros ya pagados; las
        comisiones por crear token (en SOL, al precio de hoy{d.solUsd ? `: ${usd(d.solUsd)}` : ''}) y de compra/venta
        son estimaciones sobre transacciones confirmadas. La parte de Cabal en el trading de Cabal Launch se reclama
        on-chain en Comisiones y no se cuenta aquí.
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {(
          [
            ['Desde siempre', d.all],
            ['Últimos 30 días', d.last30d],
            ['Últimos 7 días', d.last7d],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-[#0a0b08] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden /> {label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-primary">{usd(total(v))}</p>
          </div>
        ))}
      </div>

      {/* Periodo: un mes completo de un clic, o un rango a mano */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#121410] p-3">
        {presets.map(([label, r]) => (
          <button
            key={label}
            type="button"
            onClick={() => setRange(r)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              range.from === r.from && range.to === r.to
                ? 'border-[#8FA83F]/50 bg-[#8FA83F]/15 text-primary'
                : 'border-white/10 text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 sm:ml-auto">
          <Input
            type="date"
            value={range.from}
            onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
            className="h-8 w-36 border-white/10 bg-[#0a0b08] text-xs"
            aria-label="Desde"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={range.to}
            onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
            className="h-8 w-36 border-white/10 bg-[#0a0b08] text-xs"
            aria-label="Hasta"
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Ingresos del periodo · {d.range.from} → {d.range.to}
          </p>
          <p className="text-2xl font-bold tabular-nums text-primary">{usd(rangeTotal)}</p>
        </div>
        <div className="mt-3 space-y-2">
          {SOURCES.map((s) => {
            const v = d.range.bySource[s.key]
            const pct = rangeTotal > 0 ? (v / rangeTotal) * 100 : 0
            return (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center gap-2 text-[13px]">
                  <s.icon className="h-3.5 w-3.5 shrink-0" style={{ color: s.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                  <span className="text-[11px] text-muted-foreground">{pct.toFixed(0)}%</span>
                  <span className="w-24 text-right font-mono font-bold tabular-nums">{usd(v)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
        <p className="pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ingresos por día</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.series} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="rgba(143,168,63,0.07)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#8b917f', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#8b917f', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(143,168,63,0.05)' }}
                formatter={(v, name) => [usd(Number(v)), SOURCES.find((s) => s.key === name)?.label ?? String(name)]}
                contentStyle={{ background: '#121410', border: '1px solid rgba(143,168,63,0.25)', borderRadius: 10, fontSize: 12 }}
              />
              {SOURCES.map((s) => (
                <Bar key={s.key} dataKey={s.key} stackId="rev" fill={s.color} fillOpacity={0.85} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
        <p className="pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Cobros del periodo{' '}
          <span className="normal-case tracking-normal">(las comisiones de compra/venta tienen su detalle abajo)</span>
        </p>
        {d.recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin cobros en este periodo.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {d.recent.map((r, i) => {
              const s = SOURCES.find((x) => x.key === r.source) ?? SOURCES[0]
              return (
                <div key={i} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-[13px] hover:bg-white/4">
                  <s.icon className="h-3.5 w-3.5 shrink-0" style={{ color: s.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-semibold">{s.label}</span>{' '}
                      <span className="text-muted-foreground">
                        · {r.label}
                        {r.who ? ` · @${r.who}` : ''}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo(r.at)}</p>
                  </div>
                  <span className="font-mono font-bold tabular-nums text-primary">{usd(r.usd)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
