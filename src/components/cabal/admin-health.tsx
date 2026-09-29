'use client'

import { useState } from 'react'
import { Activity, AlertTriangle, Bot, Cpu, Database, Globe2, MemoryStick, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { useAdminBotMetrics, useAdminMetrics } from '@/lib/api-client'

/**
 * Salud del servidor: cuánto trabajo está haciendo Cabal ahora mismo y cómo ha
 * ido el día. Sirve para decidir cuándo hace falta ampliar el VPS.
 *
 * Los datos los recoge lib/metrics (contadores por minuto, 24 h como mucho).
 * Las visitas siguen en Estadísticas, que las trae de Umami.
 */

const RANGES = [
  { label: '1 h', minutes: 60 },
  { label: '6 h', minutes: 360 },
  { label: '24 h', minutes: 1440 },
] as const

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

export function AdminHealth() {
  const [minutes, setMinutes] = useState<number>(360)
  const { data, isPending } = useAdminMetrics(minutes)
  const points = (data?.points ?? []).map((p) => ({ ...p, hora: hhmm(p.at) }))
  const now = data?.now

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-primary" aria-hidden /> Salud del servidor
        </p>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#0a0b08] p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.minutes}
              onClick={() => setMinutes(r.minutes)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors',
                minutes === r.minutes ? 'bg-[#8FA83F]/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Conectados" value={now?.online ?? '—'} icon={<Users className="h-4 w-4" />} />
        <Tile label="Memoria" value={now?.rssMb != null ? `${now.rssMb} MB` : '—'} icon={<MemoryStick className="h-4 w-4" />} />
        <Tile label="Consultas/min" value={now?.dbPerMin ?? '—'} icon={<Database className="h-4 w-4" />} />
        <Tile label="APIs de fuera/min" value={now?.extPerMin ?? '—'} icon={<Globe2 className="h-4 w-4" />} />
        <Tile
          label="Retraso CPU"
          value={now?.lagMs != null ? `${now.lagMs} ms` : '—'}
          icon={<Cpu className="h-4 w-4" />}
          warn={(now?.lagMs ?? 0) > 200}
        />
        <Tile
          label="Fallos fuera (1 h)"
          value={now?.extErrLastHour ?? '—'}
          icon={<AlertTriangle className="h-4 w-4" />}
          warn={(now?.extErrLastHour ?? 0) > 20}
        />
      </div>

      {isPending && <div className="h-48 animate-pulse rounded-xl border border-white/10 bg-[#121410]" />}

      {!isPending && points.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Consultas a Postgres por minuto" hint="Si sube sin que suban las visitas, algo consulta de más.">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#8a8f7d' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10, fill: '#8a8f7d' }} width={32} />
                <Tooltip contentStyle={TOOLTIP} />
                <Area type="monotone" dataKey="dbPerMin" name="consultas/min" stroke="#8FA83F" fill="#8FA83F33" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Peticiones a APIs de fuera por minuto" hint="DexScreener, GeckoTerminal, Telegram, Discord…">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#8a8f7d' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10, fill: '#8a8f7d' }} width={32} />
                <Tooltip contentStyle={TOOLTIP} />
                <Area type="monotone" dataKey="extPerMin" name="peticiones/min" stroke="#5cc0f0" fill="#5cc0f033" />
                <Area type="monotone" dataKey="extErr" name="fallos" stroke="#ff8080" fill="#ff808033" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Memoria y gente conectada" hint="Si la memoria sube y no baja, toca ampliar el servidor.">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#8a8f7d' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10, fill: '#8a8f7d' }} width={32} />
                <Tooltip contentStyle={TOOLTIP} />
                <Line type="monotone" dataKey="rssMb" name="memoria (MB)" stroke="#e0b341" dot={false} />
                <Line type="monotone" dataKey="online" name="conectados" stroke="#8FA83F" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Tiempo de respuesta medio" hint="Milisegundos por consulta a Postgres y por petición de fuera.">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#8a8f7d' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10, fill: '#8a8f7d' }} width={32} />
                <Tooltip contentStyle={TOOLTIP} />
                <Line type="monotone" dataKey="dbAvgMs" name="Postgres (ms)" stroke="#8FA83F" dot={false} />
                <Line type="monotone" dataKey="extAvgMs" name="APIs de fuera (ms)" stroke="#5cc0f0" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}

      {!isPending && (data?.services.length ?? 0) > 0 && (
        <Panel title="Peticiones por servicio" hint={`En las últimas ${minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`}`}>
          <div className="space-y-1.5">
            {data!.services.slice(0, 8).map((s) => {
              const max = data!.services[0].calls || 1
              return (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-[12px] font-semibold capitalize">{s.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(s.calls / max) * 100}%` }} />
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums">{s.calls.toLocaleString('es')}</span>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {!isPending && points.length > 0 && points.every((p) => p.dbPerMin === 0 && p.extPerMin === 0) && (
        <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-muted-foreground">
          Todavía no hay datos: las métricas se empiezan a contar al arrancar el servidor y se guardan por minuto.
        </p>
      )}
    </div>
  )
}

const TOOLTIP = {
  background: '#0a0b08',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontSize: 12,
} as const

function Tile({ label, value, icon, warn }: { label: string; value: string | number; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className={cn('rounded-xl border bg-[#0a0b08] px-3.5 py-3', warn ? 'border-[#ff8080]/40' : 'border-white/10')}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', warn && 'text-[#ff8080]')}>{value}</p>
    </div>
  )
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <p className="text-[12px] font-bold">{title}</p>
      {hint && <p className="mb-2 text-[10px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

/**
 * Salud de los bots de Telegram y Discord: qué comandos se usan, cuánto tardan
 * y qué falla. Cuando un usuario manda un código ERR-XXXXXX se busca aquí.
 * Los datos salen de BotCommandLog (lib/bot-log, se guardan 30 días).
 */
const BOT_RANGES = [
  { label: '24 h', hours: 24 },
  { label: '7 d', hours: 24 * 7 },
  { label: '30 d', hours: 24 * 30 },
] as const

export function AdminBotHealth() {
  const [hours, setHours] = useState<number>(24)
  const [ref, setRef] = useState('')
  const search = /^ERR-[A-Z0-9]{6}$/i.test(ref.trim()) ? ref.trim() : ''
  const { data, isPending } = useAdminBotMetrics(hours, search)
  const errPct = data && data.total ? Math.round((data.errors / data.total) * 1000) / 10 : 0
  const seen = (p: string) => data?.lastSeen.find((l) => l.provider === p)?.at

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          <Bot className="h-3.5 w-3.5 text-primary" aria-hidden /> Bots de Telegram y Discord
        </p>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#0a0b08] p-0.5">
          {BOT_RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors',
                hours === r.hours ? 'bg-[#8FA83F]/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile label="Comandos" value={data?.total.toLocaleString('es') ?? '—'} icon={<Activity className="h-4 w-4" />} />
        <Tile
          label="Errores"
          value={data ? `${data.errors} (${errPct} %)` : '—'}
          icon={<AlertTriangle className="h-4 w-4" />}
          warn={errPct > 5}
        />
        <Tile label="Último en Telegram" value={seen('telegram') ? timeAgoEs(seen('telegram')!) : '—'} icon={<Bot className="h-4 w-4" />} />
        <Tile label="Último en Discord" value={seen('discord') ? timeAgoEs(seen('discord')!) : '—'} icon={<Bot className="h-4 w-4" />} />
      </div>

      {isPending && <div className="h-32 animate-pulse rounded-xl border border-white/10 bg-[#121410]" />}

      {!isPending && data && data.commands.length > 0 && (
        <Panel title="Comandos" hint="Usos, errores y tiempo de respuesta (media y el 5 % más lento).">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-1 text-left">Comando</th>
                  <th className="py-1 text-right">Usos</th>
                  <th className="py-1 text-right">Errores</th>
                  <th className="py-1 text-right">Media</th>
                  <th className="py-1 text-right">p95</th>
                </tr>
              </thead>
              <tbody>
                {data.commands.map((c) => (
                  <tr key={c.command} className="border-t border-white/5">
                    <td className="py-1.5 font-mono font-semibold">/{c.command}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.total.toLocaleString('es')}</td>
                    <td className={cn('py-1.5 text-right tabular-nums', c.errors > 0 && 'text-[#ff8080]')}>{c.errors}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">{c.avgMs} ms</td>
                    <td className={cn('py-1.5 text-right tabular-nums', c.p95Ms > 3000 ? 'text-[#e0b341]' : 'text-muted-foreground')}>
                      {c.p95Ms} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Errores" hint="Pega aquí el código que te mande un usuario para ver qué le pasó.">
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="ERR-XXXXXX"
          className="mb-2 w-full rounded-lg border border-white/10 bg-[#121410] px-3 py-1.5 font-mono text-[12px] uppercase outline-none focus:border-primary/50 sm:w-56"
        />
        {!isPending && data && data.recentErrors.length === 0 && (
          <p className="text-[12px] text-muted-foreground">{search ? 'No hay ningún error con ese código.' : 'Sin errores en este periodo. 👌'}</p>
        )}
        <div className="space-y-1.5">
          {data?.recentErrors.map((e) => (
            <div key={e.errorRef} className="rounded-lg border border-white/5 bg-[#121410] px-2.5 py-2 text-[12px]">
              <p className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono font-bold text-[#ff8080]">{e.errorRef}</span>
                <span className="font-mono">/{e.command}</span>
                <span className="capitalize text-muted-foreground">{e.provider}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{new Date(e.at).toLocaleString('es')}</span>
              </p>
              <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">{e.error}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function timeAgoEs(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  if (min < 1440) return `hace ${Math.round(min / 60)} h`
  return `hace ${Math.round(min / 1440)} d`
}
