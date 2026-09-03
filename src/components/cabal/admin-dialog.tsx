'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, Heart, Minus, Plus, Save, Settings2, ShieldCheck, Users, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PointsPill, UserAvatar } from '@/components/cabal/shared'
import { timeAgo } from '@/lib/cabal'
import { jsonFetch, qk, useAdminAdjustPoints, useAdminOverview, useAdminRules, useAdminUsers } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import type { AdminUserRowDTO } from '@/lib/types'

const RULE_LABELS: Record<string, string> = {
  points_thesis: 'Tesis publicada',
  points_comment: 'Comentario',
  points_launch: 'Launch publicado',
  points_like_received: 'Like recibido',
  points_hype_received: 'Hype en tu launch',
  points_daily_visit: 'Visita diaria',
}

const REASON_COLORS: Record<string, string> = {
  launch: '#8FA83F',
  thesis: '#a5bd55',
  comment: '#cdd9a3',
  like_received: '#ffb020',
  hype_received: '#ffe08a',
  admin_adjust: '#7d9340',
  redeem: '#ff4d5e',
}

type AdminView = 'puntos' | 'reglas' | 'stats'

export function AdminDialog() {
  const { adminOpen, setAdminOpen } = useUI()
  const [view, setView] = useState<AdminView>('puntos')
  const enabled = adminOpen
  const overview = useAdminOverview(enabled)
  const users = useAdminUsers(enabled)
  const rulesQ = useQuery<Record<string, number>>({
    queryKey: qk.adminRules,
    queryFn: () => jsonFetch('/api/admin/rules'),
    enabled,
  })
  const saveRules = useAdminRules(enabled)
  const adjust = useAdminAdjustPoints(enabled)

  // draft edits over the server rules — no effect needed
  const [draft, setDraft] = useState<Record<string, number>>({})
  const ruleValue = (key: string) => draft[key] ?? rulesQ.data?.[key] ?? 0
  const setRule = (key: string, v: number) => setDraft((d) => ({ ...d, [key]: v }))
  const rulesToSave = () => ({ ...(rulesQ.data ?? {}), ...draft })

  const dist = (overview.data?.distribution ?? [])
    .filter((d) => d.total > 0)
    .map((d) => ({ name: RULE_LABELS[`points_${d.reason}`] ?? d.reason, value: d.total, key: d.reason }))

  return (
    <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/12 bg-[#121410] p-0 sm:max-w-3xl" aria-describedby={undefined}>
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#121410] p-4">
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Dashboard Admin
          </DialogTitle>
          <div className="mt-3 flex gap-1.5">
            {(
              [
                { key: 'puntos', label: 'Puntos de usuarios', icon: Zap },
                { key: 'reglas', label: 'Reglas de puntos', icon: Settings2 },
                { key: 'stats', label: 'Estadísticas', icon: BarChart3 },
              ] as { key: AdminView; label: string; icon: typeof Zap }[]
            ).map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all',
                  view === v.key
                    ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                    : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30'
                )}
              >
                <v.icon className="h-3.5 w-3.5" aria-hidden />
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {view === 'puntos' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Ajusta el balance de cualquier miembro. Cada cambio queda registrado en su historial.
              </p>
              {users.isLoading && [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              {(users.data ?? []).map((u) => (
                <AdminUserRow key={u.id} user={u} onAdjust={(amount, note) => adjust.mutate({ userId: u.id, amount, note })} />
              ))}
            </div>
          )}

          {view === 'reglas' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Define cuántos puntos gana cada acción. Se aplica de inmediato para toda la comunidad.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {Object.entries(RULE_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] px-3.5 py-3">
                    <span className="flex-1 text-[13px] font-semibold">{label}</span>
                    <Input
                      type="number"
                      min={0}
                      max={10000}
                      value={ruleValue(key)}
                      onChange={(e) => setRule(key, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                      className="h-9 w-20 border-white/10 bg-[#121410] text-center font-mono font-bold text-primary"
                      aria-label={label}
                    />
                    <Zap className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  </div>
                ))}
              </div>
              <Button
                onClick={() => saveRules.mutate(rulesToSave())}
                disabled={saveRules.isPending}
                className="h-10 gap-2 rounded-xl bg-primary font-bold text-primary-foreground hover:bg-[#8FA83F]"
              >
                <Save className="h-4 w-4" /> Guardar reglas
              </Button>
            </div>
          )}

          {view === 'stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Kpi label="Miembros" value={overview.data?.totalUsers ?? 0} icon={<Users className="h-4 w-4" />} />
                <Kpi label="Posts" value={overview.data?.totalPosts ?? 0} />
                <Kpi label="Launches" value={overview.data?.totalLaunches ?? 0} />
                <Kpi label="Tokens" value={overview.data?.totalTokens ?? 0} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Puntos en circulación</p>
                  <p className="font-machina mt-1 text-3xl font-bold text-primary">
                    {(overview.data?.pointsInCirculation ?? 0).toLocaleString('es')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Emitidos históricos: {(overview.data?.pointsIssuedTotal ?? 0).toLocaleString('es')}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Top earners</p>
                  <div className="mt-2 space-y-1.5">
                    {(overview.data?.topEarners ?? []).map((t, i) => (
                      <div key={t.user.id} className="flex items-center gap-2 text-[13px]">
                        <span className="w-4 text-muted-foreground">{i + 1}.</span>
                        <UserAvatar name={t.user.name} handle={t.user.handle} size="xs" ring={false} />
                        <span className="flex-1 truncate font-medium">{t.user.name}</span>
                        <PointsPill points={t.points} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
                <p className="pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Distribución de puntos por actividad</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dist} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
                      <CartesianGrid stroke="rgba(143,168,63,0.07)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#8b917f', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis tick={{ fill: '#8b917f', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(143,168,63,0.05)' }}
                        contentStyle={{ background: '#121410', border: '1px solid rgba(143,168,63,0.25)', borderRadius: 10, fontSize: 12 }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {dist.map((d) => (
                          <Cell key={d.key} fill={REASON_COLORS[d.key] ?? '#8FA83F'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
                <p className="pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Actividad reciente de puntos</p>
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {(overview.data?.recentEvents ?? []).map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/4">
                      <UserAvatar name={e.user.name} handle={e.user.handle} size="xs" ring={false} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">
                          <span className="font-semibold">{e.user.name}</span> <span className="text-muted-foreground">· {e.note}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">{timeAgo(e.createdAt)}</p>
                      </div>
                      <span className={cn('font-mono text-[13px] font-bold', e.amount >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
                        {e.amount >= 0 ? '+' : ''}{e.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AdminUserRow({
  user,
  onAdjust,
}: {
  user: AdminUserRowDTO
  onAdjust: (amount: number, note?: string) => void
}) {
  const [amount, setAmount] = useState('50')
  const [note, setNote] = useState('')
  const amt = parseInt(amount, 10) || 0

  const doAdjust = (sign: 1 | -1) => {
    if (amt <= 0) {
      toast.error('Ingresa un monto mayor a 0')
      return
    }
    onAdjust(sign * amt, note.trim() || undefined)
    setNote('')
    toast.success(`${sign > 0 ? '+' : '-'}${amt} puntos para @${user.handle}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <UserAvatar name={user.name} handle={user.handle} size="md" verified={user.walletVerified} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {user.name}
          {user.isAdmin && <span className="ml-1.5 rounded bg-[#8FA83F]/12 px-1 py-px text-[9px] font-black text-primary">ADMIN</span>}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          @{user.handle} · {user.postsCount} posts · {user.launchesCount} launches · {user.likesReceived}
          <Heart className="h-3 w-3" aria-hidden />
        </p>
      </div>
      <PointsPill points={user.points} />
      <div className="flex items-center gap-1.5">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motivo (opcional)"
          className="h-8 w-36 border-white/10 bg-[#121410] text-xs"
          aria-label="Motivo del ajuste"
        />
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 w-16 border-white/10 bg-[#121410] text-center font-mono text-xs font-bold"
          aria-label="Monto"
        />
        <Button size="icon" onClick={() => doAdjust(1)} className="h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-[#8FA83F]" aria-label="Añadir puntos">
          <Plus className="h-4 w-4" strokeWidth={3} />
        </Button>
        <Button size="icon" variant="secondary" onClick={() => doAdjust(-1)} className="h-8 w-8 rounded-lg text-[#ff8080] hover:bg-destructive/15" aria-label="Quitar puntos">
          <Minus className="h-4 w-4" strokeWidth={3} />
        </Button>
      </div>
    </div>
  )
}

function Kpi({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
