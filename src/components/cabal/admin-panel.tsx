'use client'

import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  BarChart3,
  BadgeCheck,
  CheckCircle2,
  Coins,
  CreditCard,
  Crown,
  ExternalLink,
  Eye,
  Globe,
  Heart,
  Link2,
  MessageSquareWarning,
  Megaphone,
  Minus,
  Pencil,
  Percent,
  Plus,
  Rocket,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { NETWORKS, fmtPct, networkMeta, timeAgo } from '@/lib/cabal'
import { AFFILIATE_NETWORKS, platformLinkFor } from '@/lib/affiliate'
import { CopyCA, PointsPill, TokenGlyph, UserAvatar, NetworkIcon, TimezoneHint } from '@/components/cabal/shared'
import { ImageDrop } from '@/components/cabal/image-drop'
import { AdminUsers } from '@/components/cabal/admin-users'
import { AdminNotify } from '@/components/cabal/admin-notify'
import {
  jsonFetch,
  qk,
  uploadImage,
  useAdminAdjustPoints,
  useAdminAffiliates,
  useAdminCalls,
  useAdminBackfillCallEntry,
  useAdminBackfillLaunchPoints,
  useAdminCreateAffiliate,
  useAdminDeleteAffiliate,
  useAdminDeleteLaunch,
  useAdminLaunches,
  useAdminOverview,
  useAdminDeletePost,
  useAdminGrantPremium,
  useAdminPosts,
  useAdminPremium,
  useAdminRevokePremium,
  useAdminRules,
  useAdminSaveAffiliate,
  useAdminSaveSwapFee,
  useAdminSwapFees,
  useAdminTokens,
  useAdminUpdateLaunch,
  useAdminUpdateToken,
  useAdminUpdateUser,
  useAdminUsers,
  useAdminReviewVerification,
  useAdminVerifyRequests,
} from '@/lib/api-client'
import type {
  AdminSubscriptionDTO,
  AdminUserRowDTO,
  AffiliatePlatformDTO,
  LaunchDTO,
  ProjectClaimDTO,
  SwapFeeConfigDTO,
  TokenDTO,
} from '@/lib/types'

/** Placeholder de ejemplo por red, con el formato real de GMGN/Axiom. */
const NETWORK_PLACEHOLDER: Record<string, string> = {
  solana: 'https://gmgn.ai/sol/token/TUCODIGO_{ca}',
  base: 'https://gmgn.ai/base/token/TUCODIGO_{ca}',
  ethereum: 'https://gmgn.ai/eth/token/TUCODIGO_{ca}',
  bsc: 'https://axiom.trade/t/{ca}/@usuario?chain=bnb',
  tron: 'https://…/token/{ca}',
  robinhood: 'https://axiom.trade/t/{ca}/@usuario?chain=robinhood',
  arc: 'https://…/token/{ca}',
}

const RULE_LABELS: Record<string, string> = {
  points_thesis: 'Tesis publicada',
  points_comment: 'Comentario',
  points_launch: 'Launch publicado',
  points_like_received: 'Like recibido',
  points_hype_received: 'Hype en tu launch',
  points_daily_visit: 'Visita diaria',
  points_referral_percent: 'Referidos (% del equipo)',
  points_swap_referral_pct: 'Referidos por compra/venta (% de la comisión)',
  points_per_usd_fee: 'Puntos por cada $1 de esa comisión',
  points_share_x: 'Compartir tarjeta en X',
  points_follow_x: 'Seguir a @Cabal_app en X',
  points_share_follow_x: 'Compartir la tarjeta de "sigo a Cabal"',
}

type AdminAnalyticsDTO =
  | { configured: false }
  | {
      configured: true
      dashboardUrl: string
      today: { visitors: number; pageviews: number; visits: number }
      last7Days: { visitors: number; pageviews: number; visits: number }
      last30Days: { visitors: number; pageviews: number; visits: number }
      avgDailyVisitors30d: number
      series: { date: string; visitors: number }[]
    }

const REASON_COLORS: Record<string, string> = {
  launch: '#8FA83F',
  thesis: '#a5bd55',
  comment: '#cdd9a3',
  like_received: '#ffb020',
  hype_received: '#ffe08a',
  admin_adjust: '#7d9340',
  redeem: '#ff4d5e',
  verify_x: '#9945FF',
  verify_google: '#8A92B2',
  share_x: '#1d9bf0',
  follow_x: '#1d9bf0',
  share_follow_x: '#5ec2f7',
}

type AdminView =
  | 'notificaciones'
  | 'usuarios'
  | 'premium'
  | 'reclamos'
  | 'verificacion'
  | 'reglas'
  | 'proyectos'
  | 'tokens'
  | 'afiliados'
  | 'comisiones'
  | 'calls'
  | 'moderacion'
  | 'stats'

function toInputDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Toggle pequeño tipo chip para campos booleanos
function ChipToggle({
  label,
  checked,
  onChange,
  okIcon = true,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  okIcon?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all',
        checked
          ? 'border-[#8FA83F]/45 bg-[#8FA83F]/12 text-primary'
          : 'border-white/10 bg-[#121410] text-muted-foreground hover:border-white/25'
      )}
    >
      {okIcon &&
        (checked ? (
          <CheckCircle2 className="h-3 w-3" aria-hidden />
        ) : (
          <XCircle className="h-3 w-3" aria-hidden />
        ))}
      {label}
    </button>
  )
}

/**
 * Contenido completo del dashboard de administración.
 * Reutilizado por AdminDialog (modal de la app) y por la página standalone /admin.
 */
export function AdminPanel({
  enabled = true,
  stickyHeader = true,
  onClose,
}: {
  /** Activa las queries del panel (en el diálogo solo cuando está abierto). */
  enabled?: boolean
  /** Header pegajoso. En /admin el header de la página ya es sticky, así que se desactiva. */
  stickyHeader?: boolean
  /** Acción opcional de cierre (muestra un botón "Cerrar" junto al título). */
  onClose?: () => void
}) {
  const [view, setView] = useState<AdminView>('usuarios')
  const overview = useAdminOverview(enabled)
  const users = useAdminUsers(enabled)
  const analytics = useQuery<AdminAnalyticsDTO>({
    queryKey: ['admin', 'analytics'],
    queryFn: () => jsonFetch('/api/admin/analytics'),
    enabled: enabled && view === 'stats',
    refetchInterval: 60_000,
  })
  // Casi todo son números de puntos; follow_x_deadline es la fecha de cierre de
  // la campaña de X (yyyy-mm-dd), que se edita en esta misma pantalla.
  const rulesQ = useQuery<Record<string, number | string>>({
    queryKey: qk.adminRules,
    queryFn: () => jsonFetch('/api/admin/rules'),
    enabled,
  })
  const saveRules = useAdminRules(enabled)
  const adjust = useAdminAdjustPoints(enabled)

  // draft edits over the server rules — no effect needed
  const [draft, setDraft] = useState<Record<string, number | string>>({})
  const ruleValue = (key: string) => Number(draft[key] ?? rulesQ.data?.[key] ?? 0)
  const setRule = (key: string, v: number | string) => setDraft((d) => ({ ...d, [key]: v }))
  const deadlineValue = String(draft.follow_x_deadline ?? rulesQ.data?.follow_x_deadline ?? '')
  const rulesToSave = () => ({ ...(rulesQ.data ?? {}), ...draft })

  const dist = (overview.data?.distribution ?? [])
    .filter((d) => d.total > 0)
    .map((d) => ({ name: RULE_LABELS[`points_${d.reason}`] ?? d.reason, value: d.total, key: d.reason }))

  const NAV_ITEMS = [
    { key: 'usuarios', label: 'Usuarios y perfiles', icon: Users },
    { key: 'premium', label: 'Plan Premium', icon: Crown },
    { key: 'verificacion', label: 'Verificación oficial', icon: ShieldCheck },
    { key: 'reclamos', label: 'Reclamos de proyectos', icon: BadgeCheck },
    { key: 'proyectos', label: 'Proyectos (launches)', icon: Rocket },
    { key: 'tokens', label: 'Tokens', icon: Coins },
    { key: 'afiliados', label: 'Plataformas afiliadas', icon: Link2 },
    { key: 'comisiones', label: 'Comisiones de compra/venta', icon: Percent },
    { key: 'calls', label: 'Calls por usuario', icon: Megaphone },
    { key: 'moderacion', label: 'Moderación del feed', icon: MessageSquareWarning },
    { key: 'reglas', label: 'Reglas de puntos', icon: Settings2 },
    { key: 'notificaciones', label: 'Telegram y Discord', icon: Send },
    { key: 'stats', label: 'Estadísticas', icon: BarChart3 },
  ] as { key: AdminView; label: string; icon: typeof Zap }[]

  return (
    <div className="flex flex-col sm:flex-row sm:items-stretch">
      {/* Menú lateral: fijo a la izquierda en pantallas sm+, scroll horizontal en móvil */}
      <div
        className={cn(
          'z-10 shrink-0 border-b border-white/10 bg-[#121410] p-4 sm:w-60 sm:border-b-0 sm:border-r sm:p-3',
          stickyHeader && 'sticky top-0 sm:max-h-screen sm:overflow-y-auto'
        )}
      >
        <div className="flex items-center gap-2 sm:px-1">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Dashboard Admin
          </h2>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="ml-auto h-8 rounded-lg border border-white/10 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground sm:hidden"
            >
              Cerrar
            </Button>
          )}
        </div>
        <nav className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto sm:mt-4 sm:flex-col sm:gap-1 sm:overflow-visible">
          {NAV_ITEMS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all',
                'sm:w-full sm:shrink sm:justify-start sm:rounded-lg sm:border-transparent sm:px-3 sm:py-2',
                view === v.key
                  ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                  : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30 sm:hover:bg-white/5'
              )}
            >
              <v.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{v.label}</span>
            </button>
          ))}
        </nav>
        {onClose && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="mt-4 hidden h-8 w-full rounded-lg border border-white/10 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground sm:flex"
          >
            Cerrar
          </Button>
        )}
      </div>

      <div className="min-w-0 flex-1 p-4">
        {view === 'usuarios' && (
          <AdminUsers
            enabled={enabled}
            users={users.data}
            loading={users.isLoading}
            renderRow={(u, i) => (
              <AdminUserRow
                key={u.id}
                index={i}
                user={u}
                enabled={enabled}
                onAdjust={(amount, note) => adjust.mutate({ userId: u.id, amount, note })}
              />
            )}
          />
        )}

        {view === 'premium' && <AdminPremium enabled={enabled} />}

        {view === 'verificacion' && <AdminVerification enabled={enabled} />}
        {view === 'reclamos' && <AdminClaims enabled={enabled} />}

        {view === 'proyectos' && <AdminLaunches enabled={enabled} />}

        {view === 'tokens' && <AdminTokens enabled={enabled} />}

        {view === 'afiliados' && <AdminAffiliates enabled={enabled} />}

        {view === 'comisiones' && <AdminSwapFees enabled={enabled} />}

        {view === 'calls' && <AdminCalls enabled={enabled} />}

        {view === 'moderacion' && <AdminModeration enabled={enabled} />}

        {view === 'notificaciones' && <AdminNotify enabled={enabled} />}

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
            {/* Cierre de la campaña de X. No es un número de puntos, pero se
                guarda con el mismo botón: quien mueve los 15 puntos suele
                querer mover también hasta cuándo se dan. */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">Campaña &ldquo;sigue a @Cabal_app&rdquo;: último día</p>
                <p className="text-[11px] text-muted-foreground">
                  Pasada esa fecha (23:59 UTC) dejan de abonarse los dos bonus de la campaña.
                </p>
              </div>
              <Input
                type="date"
                value={deadlineValue}
                onChange={(e) => setRule('follow_x_deadline', e.target.value)}
                className="h-9 w-40 border-white/10 bg-[#121410] text-center font-mono font-bold text-primary"
                aria-label="Último día de la campaña de X"
              />
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
            {analytics.data?.configured === false ? (
              <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4 text-xs text-muted-foreground">
                Analytics de visitas (Umami) no está configurado. Faltan las variables{' '}
                <code className="text-primary">UMAMI_URL</code>, <code className="text-primary">UMAMI_WEBSITE_ID</code>,{' '}
                <code className="text-primary">UMAMI_USERNAME</code> y <code className="text-primary">UMAMI_PASSWORD</code> en el servicio.
              </div>
            ) : analytics.data?.configured ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    <Eye className="h-3.5 w-3.5 text-primary" aria-hidden /> Visitas del sitio
                  </p>
                  <a
                    href={analytics.data.dashboardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    Ver panel completo <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Kpi label="Visitantes hoy" value={analytics.data.today.visitors} icon={<Eye className="h-4 w-4" />} />
                  <Kpi label="Prom. diario (30d)" value={analytics.data.avgDailyVisitors30d} />
                  <Kpi label="Visitantes 7 días" value={analytics.data.last7Days.visitors} />
                  <Kpi label="Vistas de página (30d)" value={analytics.data.last30Days.pageviews} />
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
                  <p className="pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Visitantes por día (últimos 14 días)
                  </p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.data.series} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid stroke="rgba(143,168,63,0.07)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#8b917f', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#8b917f', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          cursor={{ stroke: 'rgba(143,168,63,0.25)' }}
                          contentStyle={{ background: '#121410', border: '1px solid rgba(143,168,63,0.25)', borderRadius: 10, fontSize: 12 }}
                        />
                        <Line type="monotone" dataKey="visitors" stroke="#8FA83F" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : analytics.isError ? (
              <div className="rounded-xl border border-[#ff4d5e]/30 bg-[#0a0b08] p-4 text-xs text-[#ff8080]">
                No se pudieron cargar las visitas: {analytics.error.message}
              </div>
            ) : (
              <Skeleton className="h-40 w-full" />
            )}

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
                      <UserAvatar name={t.user.name} handle={t.user.handle} src={t.user.avatar} size="xs" ring={false} />
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
                    <UserAvatar name={e.user.name} handle={e.user.handle} src={e.user.avatar} size="xs" ring={false} />
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
    </div>
  )
}

// ---------------- Usuarios: puntos + edición de perfil ----------------
function AdminUserRow({
  index,
  user,
  enabled,
  onAdjust,
}: {
  index: number
  user: AdminUserRowDTO
  enabled: boolean
  onAdjust: (amount: number, note?: string) => void
}) {
  const updateUser = useAdminUpdateUser(enabled)
  const [amount, setAmount] = useState('50')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: user.name,
    handle: user.handle,
    xHandle: user.xHandle ?? '',
    tgHandle: user.tgHandle ?? '',
    googleEmail: user.googleEmail ?? '',
    walletVerified: user.walletVerified,
    xVerified: user.xVerified,
    googleVerified: user.googleVerified,
    isDev: user.isDev,
    isAdmin: user.isAdmin ?? false,
    verified: user.verified,
  })
  const amt = parseInt(amount, 10) || 0
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const doAdjust = (sign: 1 | -1) => {
    if (amt <= 0) {
      toast.error('Ingresa un monto mayor a 0')
      return
    }
    onAdjust(sign * amt, note.trim() || undefined)
    setNote('')
    toast.success(`${sign > 0 ? '+' : '-'}${amt} puntos para @${user.handle}`)
  }

  const save = () => {
    updateUser.mutate(
      {
        id: user.id,
        name: form.name,
        handle: form.handle,
        xHandle: form.xHandle,
        tgHandle: form.tgHandle,
        googleEmail: form.googleEmail,
        walletVerified: form.walletVerified,
        xVerified: form.xVerified,
        googleVerified: form.googleVerified,
        isDev: form.isDev,
        isAdmin: form.isAdmin,
        // Solo si cambió: guardar sin tocarlo no convierte una verificación Premium en permanente
        ...(form.verified !== user.verified && { verified: form.verified }),
      },
      { onSuccess: () => setEditing(false) }
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="w-8 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-muted-foreground">#{index}</span>
        <UserAvatar name={user.name} handle={user.handle} src={user.avatar} size="md" verified={user.walletVerified} official={user.verified} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {user.name}
            {user.isAdmin && <span className="ml-1.5 rounded bg-[#8FA83F]/12 px-1 py-px text-[9px] font-black text-primary">ADMIN</span>}
            {user.xVerified && <span className="ml-1 rounded bg-white/8 px-1 py-px text-[9px] font-black text-zinc-300">X</span>}
            {user.googleVerified && <span className="ml-1 rounded bg-white/8 px-1 py-px text-[9px] font-black text-zinc-300">G</span>}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            @{user.handle} · {user.contactEmail ?? 'sin correo'}{user.shared ? ' · compartió' : ''} · {user.postsCount} posts · {user.launchesCount} launches · {user.likesReceived}
            <Heart className="h-3 w-3" aria-hidden />
          </p>
        </div>
        <PointsPill points={user.points} />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing((v) => !v)}
          className="h-8 gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3 w-3" /> {editing ? 'Cerrar' : 'Editar'}
        </Button>
        <div className="flex items-center gap-1.5">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motivo (opcional)"
            className="h-8 w-32 border-white/10 bg-[#121410] text-xs"
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

      {editing && (
        <div className="mt-3 space-y-3 rounded-lg border border-white/8 bg-[#121410] p-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nombre</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="h-8 bg-[#0a0b08] text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Handle</Label>
              <Input value={form.handle} onChange={(e) => set('handle', e.target.value)} className="h-8 bg-[#0a0b08] font-mono text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">X (Twitter)</Label>
              <Input value={form.xHandle} onChange={(e) => set('xHandle', e.target.value)} placeholder="@usuario" className="h-8 bg-[#0a0b08] text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Telegram</Label>
              <Input value={form.tgHandle} onChange={(e) => set('tgHandle', e.target.value)} placeholder="@usuario" className="h-8 bg-[#0a0b08] text-[13px]" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Google (email)</Label>
              <Input value={form.googleEmail} onChange={(e) => set('googleEmail', e.target.value)} placeholder="usuario@gmail.com" className="h-8 bg-[#0a0b08] text-[13px]" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ChipToggle label="Wallet verificada" checked={form.walletVerified} onChange={(v) => set('walletVerified', v)} />
            <ChipToggle label="X verificada" checked={form.xVerified} onChange={(v) => set('xVerified', v)} />
            <ChipToggle label="Google verificada" checked={form.googleVerified} onChange={(v) => set('googleVerified', v)} />
            <ChipToggle label="Dev" checked={form.isDev} onChange={(v) => set('isDev', v)} okIcon={false} />
            <ChipToggle label="Admin" checked={form.isAdmin} onChange={(v) => set('isAdmin', v)} okIcon={false} />
            <ChipToggle label="Verificado oficial" checked={form.verified} onChange={(v) => set('verified', v)} />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={save}
              disabled={updateUser.isPending}
              className="h-8 gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
            >
              <Save className="h-3.5 w-3.5" /> {updateUser.isPending ? 'Guardando…' : 'Guardar perfil'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- Proyectos (launches) ----------------
function AdminLaunches({ enabled }: { enabled: boolean }) {
  const launches = useAdminLaunches(enabled)
  const backfillPoints = useAdminBackfillLaunchPoints()
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Corrige cualquier dato de un lanzamiento: nombre, ticker, fecha, red, imágenes, redes sociales, contrato, privacidad, visibilidad, checks de seguridad y el stream en vivo.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={backfillPoints.isPending}
          onClick={() => backfillPoints.mutate()}
        >
          {backfillPoints.isPending ? 'Otorgando…' : 'Dar puntos pendientes'}
        </Button>
      </div>
      {launches.isLoading && [...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      {(launches.data ?? []).map((l) => (
        <AdminLaunchRow key={l.id} launch={l} enabled={enabled} />
      ))}
    </div>
  )
}

function AdminLaunchRow({ launch, enabled }: { launch: LaunchDTO; enabled: boolean }) {
  const updateLaunch = useAdminUpdateLaunch(enabled)
  const deleteLaunch = useAdminDeleteLaunch(enabled)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: launch.name,
    ticker: launch.ticker ?? '',
    isPrivate: launch.isPrivate,
    network: launch.network,
    launchAt: toInputDateTime(launch.launchAt),
    dateConfirmed: launch.dateConfirmed,
    description: launch.description,
    image: launch.image ?? '',
    banner: launch.banner ?? '',
    website: launch.website ?? '',
    twitter: launch.twitter ?? '',
    telegram: launch.telegram ?? '',
    contract: launch.contract ?? '',
    isLive: launch.isLive ?? false,
    liveUrl: launch.liveUrl ?? '',
    hidden: launch.hidden ?? false,
    submitterRole: launch.submitterRole,
    lpLocked: launch.lpLocked,
    mintRevoked: launch.mintRevoked,
    top10Pct: String(launch.top10Pct),
    verified: launch.verified,
  })
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const pick = (key: 'image' | 'banner') => async (file: File) => {
    try {
      const url = await uploadImage(file)
      set(key, url)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const save = () => {
    updateLaunch.mutate(
      {
        id: launch.id,
        name: form.name,
        ticker: form.ticker,
        isPrivate: form.isPrivate,
        network: form.network,
        launchAt: new Date(form.launchAt).toISOString(),
        dateConfirmed: form.dateConfirmed,
        description: form.description,
        image: form.image,
        banner: form.banner,
        website: form.website.trim(),
        twitter: form.twitter.trim(),
        telegram: form.telegram.trim(),
        contract: form.contract.trim(),
        isLive: form.isLive,
        liveUrl: form.isLive ? form.liveUrl.trim() : '',
        hidden: form.hidden,
        submitterRole: form.submitterRole,
        lpLocked: form.lpLocked,
        mintRevoked: form.mintRevoked,
        top10Pct: Math.max(0, Math.min(100, Math.round(Number(form.top10Pct) || 0))),
        ...(form.verified !== launch.verified && { verified: form.verified }),
      },
      { onSuccess: () => setEditing(false) }
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <TokenGlyph src={launch.image} ticker={launch.ticker ?? launch.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {launch.name}{' '}
            <span className="font-mono text-xs text-primary">{launch.ticker ? `$${launch.ticker}` : ''}</span>
            {launch.isPrivate && (
              <span className="ml-1.5 rounded bg-amber-300/12 px-1 py-px text-[9px] font-black uppercase text-amber-300">Privado</span>
            )}
            {launch.hidden && (
              <span className="ml-1.5 rounded bg-amber-300/12 px-1 py-px text-[9px] font-black uppercase text-amber-300">Oculto</span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {NETWORKS[launch.network as keyof typeof NETWORKS]?.label ?? launch.network} ·{' '}
            {new Date(launch.launchAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {!launch.dateConfirmed && ' (estimada)'} · hype {launch.hype}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing((v) => !v)}
          className="h-8 gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3 w-3" /> {editing ? 'Cerrar' : 'Editar'}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              disabled={deleteLaunch.isPending}
              className="h-8 w-8 rounded-lg border border-white/10 text-[#ff8080] hover:bg-destructive/15"
              aria-label="Eliminar launch"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/12 bg-[#121410]">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">¿Eliminar este launch?</AlertDialogTitle>
              <AlertDialogDescription>
                Los comentarios se conservarán sin proyecto asociado. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteLaunch.mutate(launch.id)}
                className="bg-[#ff4d5e] text-white hover:bg-[#ff4d5e]/85"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 rounded-lg border border-white/8 bg-[#121410] p-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nombre</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="h-8 bg-[#0a0b08] text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ticker (opcional)</Label>
              <Input value={form.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())} className="h-8 bg-[#0a0b08] font-mono text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fecha y hora</Label>
              <Input type="datetime-local" value={form.launchAt} onChange={(e) => set('launchAt', e.target.value)} className="h-8 bg-[#0a0b08] text-[13px] [color-scheme:dark]" />
              <TimezoneHint value={form.launchAt} compact />
              <label className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!form.dateConfirmed}
                  onChange={(e) => set('dateConfirmed', !e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-300"
                />
                Fecha estimada, aún no confirmada
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Red</Label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(NETWORKS).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set('network', key)}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold',
                      form.network === key ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground'
                    )}
                  >
                    <NetworkIcon network={key} className="h-3 w-3" />
                    {meta.short}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Website</Label>
              <Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" className="h-8 bg-[#0a0b08] text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Twitter / X</Label>
              <Input value={form.twitter} onChange={(e) => set('twitter', e.target.value)} placeholder="https://x.com/…" className="h-8 bg-[#0a0b08] text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Telegram</Label>
              <Input value={form.telegram} onChange={(e) => set('telegram', e.target.value)} placeholder="https://t.me/…" className="h-8 bg-[#0a0b08] text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">CA / Contrato del token (opcional)</Label>
              <Input value={form.contract} onChange={(e) => set('contract', e.target.value)} placeholder="0x… / dirección del contrato" className="h-8 bg-[#0a0b08] font-mono text-[13px]" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <ImageDrop
              url={form.image}
              onSelect={pick('image')}
              onPickUrl={(u) => set('image', u)}
              onRemove={() => set('image', '')}
              aspect="square"
              label="Logo / imagen"
              hint="Subir logo"
            />
            <ImageDrop
              url={form.banner}
              onSelect={pick('banner')}
              onPickUrl={(u) => set('banner', u)}
              onRemove={() => set('banner', '')}
              aspect="video"
              label="Banner"
              hint="Sube un banner (16:9)"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Descripción</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="min-h-[56px] resize-none bg-[#0a0b08] text-[13px]" />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ChipToggle label="Ticker privado" checked={form.isPrivate} onChange={(v) => set('isPrivate', v)} okIcon={false} />
            <ChipToggle label="Oculto del radar" checked={form.hidden} onChange={(v) => set('hidden', v)} />
            <ChipToggle label="Launch oficial (verificado)" checked={form.verified} onChange={(v) => set('verified', v)} />
            <ChipToggle
              label="Es el dev"
              checked={form.submitterRole === 'dev'}
              onChange={(v) => set('submitterRole', v ? 'dev' : 'community')}
              okIcon={false}
            />
            <ChipToggle label="En vivo (streaming)" checked={form.isLive} onChange={(v) => set('isLive', v)} />
            <ChipToggle label="LP bloqueada" checked={form.lpLocked} onChange={(v) => set('lpLocked', v)} />
            <ChipToggle label="Mint revocado" checked={form.mintRevoked} onChange={(v) => set('mintRevoked', v)} />
            <span className="ml-auto flex items-center gap-1.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Top10 %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.top10Pct}
                onChange={(e) => set('top10Pct', e.target.value)}
                className="h-8 w-16 border-white/10 bg-[#0a0b08] text-center font-mono text-[13px]"
              />
            </span>
          </div>

          {form.isLive && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Link del stream en vivo (YouTube, Twitch, Vimeo…)</Label>
              <Input
                value={form.liveUrl}
                onChange={(e) => set('liveUrl', e.target.value)}
                placeholder="https://www.youtube.com/live/…"
                autoComplete="off"
                spellCheck={false}
                className="h-8 bg-[#0a0b08] text-[13px]"
              />
              <p className="text-[10px] text-muted-foreground">Se incrusta el video en el pop-up del launch mientras esté marcado como en vivo.</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={save}
              disabled={updateLaunch.isPending}
              className="h-8 gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
            >
              <Save className="h-3.5 w-3.5" /> {updateLaunch.isPending ? 'Guardando…' : 'Guardar launch'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- Tokens (logo, métricas) ----------------
function AdminTokens({ enabled }: { enabled: boolean }) {
  const tokens = useAdminTokens(enabled)
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Edita tokens en vivo: logo, nombre, ticker, red y métricas. Ej: actualiza el logo del Cabal Coin aquí.
      </p>
      {tokens.isLoading && [...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      {(tokens.data ?? []).map((t) => (
        <AdminTokenRow key={t.id} token={t} enabled={enabled} />
      ))}
    </div>
  )
}

// ---------------- Plataformas afiliadas (enlace madre de referido) ----------------
// ── Plan Premium: quién es suscriptor, quién no, y regalar/retirar acceso ──
const PREMIUM_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'ACTIVO', cls: 'border-[#8FA83F]/40 bg-[#8FA83F]/12 text-primary' },
  trialing: { label: 'PRUEBA', cls: 'border-[#8FA83F]/40 bg-[#8FA83F]/12 text-primary' },
  past_due: { label: 'PAGO VENCIDO', cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
  canceled: { label: 'CANCELADO', cls: 'border-white/15 bg-white/5 text-muted-foreground' },
  unpaid: { label: 'IMPAGO', cls: 'border-[#ff8080]/30 bg-[#ff8080]/10 text-[#ff8080]' },
  incomplete: { label: 'INCOMPLETO', cls: 'border-white/15 bg-white/5 text-muted-foreground' },
  incomplete_expired: { label: 'EXPIRADO', cls: 'border-white/15 bg-white/5 text-muted-foreground' },
  paused: { label: 'PAUSADO', cls: 'border-white/15 bg-white/5 text-muted-foreground' },
}

const PREMIUM_PROVIDER_LABEL: Record<string, string> = {
  stripe: 'Tarjeta (Stripe)',
  nowpayments: 'Cripto (NOWPayments)',
  admin: 'Regalado por admin',
}

function AdminPremium({ enabled }: { enabled: boolean }) {
  const data = useAdminPremium(enabled)
  const grant = useAdminGrantPremium()
  const revoke = useAdminRevokePremium()
  const [handle, setHandle] = useState('')
  const [days, setDays] = useState('30')
  const [note, setNote] = useState('')

  const doGrant = () => {
    const h = handle.trim().replace(/^@+/, '')
    if (!h) {
      toast.error('Escribe el @usuario')
      return
    }
    const parsedDays = days.trim() === '' ? null : Math.round(Number(days))
    if (parsedDays !== null && !(Number.isFinite(parsedDays) && parsedDays >= 1)) {
      toast.error('Días no válidos (déjalo vacío para sin caducidad)')
      return
    }
    grant.mutate(
      { handle: h, days: parsedDays, note: note.trim() || undefined },
      { onSuccess: () => { setHandle(''); setNote('') } }
    )
  }

  const s = data.data?.stats
  const revenue = data.data?.stats.revenue30d ?? 0

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Quién tiene el plan Premium activo, por qué medio pagó, y el historial de cobros. Desde aquí también se regala
        acceso (colaboradores, pruebas) sin necesidad de que pase por Stripe o NOWPayments.
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Kpi label="Premium activos" value={s?.activeUsers ?? 0} icon={<Crown className="h-3.5 w-3.5" />} />
        <Kpi label="Con tarjeta" value={s?.stripe ?? 0} icon={<CreditCard className="h-3.5 w-3.5" />} />
        <Kpi label="Con cripto" value={s?.crypto ?? 0} icon={<Coins className="h-3.5 w-3.5" />} />
        <Kpi label="Regalados" value={s?.admin ?? 0} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        <div className="rounded-xl border border-white/10 bg-[#0a0b08] px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Ingresos 30d
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">${revenue.toLocaleString('es')}</p>
        </div>
      </div>

      {data.data && !data.data.providers.stripe.configured && !data.data.providers.nowpayments.configured && (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-2.5 text-[12px] text-amber-200">
          Ni Stripe ni NOWPayments están configurados (faltan las claves en el entorno): nadie puede pagar todavía,
          solo se puede regalar acceso desde aquí.
        </p>
      )}

      {/* Regalar acceso */}
      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Regalar Premium</p>
        <div className="grid gap-2 sm:grid-cols-[160px_100px_1fr_auto]">
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@usuario"
            aria-label="Usuario"
            className="h-9 bg-[#121410] text-[13px]"
          />
          <Input
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="Días"
            aria-label="Días (vacío = sin caducidad)"
            className="h-9 bg-[#121410] text-center text-[13px]"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motivo (opcional)"
            aria-label="Motivo"
            className="h-9 bg-[#121410] text-[13px]"
          />
          <Button
            onClick={doGrant}
            disabled={grant.isPending || !handle.trim()}
            className="h-9 gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-bold text-[#171200] hover:bg-amber-300"
          >
            <Crown className="h-3.5 w-3.5 fill-[#171200]" /> Regalar
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Deja "Días" vacío para dar acceso sin caducidad.</p>
      </div>

      {/* Suscriptores */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Suscriptores</p>
        {data.isLoading && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        {(data.data?.subscriptions ?? []).map((sub) => (
          <AdminPremiumRow key={sub.id} sub={sub} onRevoke={() => revoke.mutate(sub.id)} revoking={revoke.isPending} />
        ))}
        {!data.isLoading && (data.data?.subscriptions ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-white/12 py-6 text-center text-xs text-muted-foreground">
            Todavía nadie es Premium.
          </p>
        )}
      </div>

      {/* Historial de pagos */}
      {(data.data?.payments ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Últimos pagos</p>
          {(data.data?.payments ?? []).map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#0a0b08] p-2.5 text-xs">
              <UserAvatar name={p.user.name} handle={p.user.handle} src={p.user.avatar} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold">@{p.user.handle}</span>
              <span className="text-muted-foreground">{PREMIUM_PROVIDER_LABEL[p.provider] ?? p.provider}</span>
              <span className="font-bold tabular-nums">${p.amountUsd.toLocaleString('es')}</span>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', p.status === 'paid' || p.status === 'finished' ? 'bg-[#8FA83F]/15 text-primary' : 'bg-white/5 text-muted-foreground')}>
                {p.status}
              </span>
              <span className="text-muted-foreground">{timeAgo(p.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminPremiumRow({
  sub,
  onRevoke,
  revoking,
}: {
  sub: AdminSubscriptionDTO
  onRevoke: () => void
  revoking: boolean
}) {
  const status = PREMIUM_STATUS[sub.status] ?? { label: sub.status.toUpperCase(), cls: 'border-white/15 bg-white/5 text-muted-foreground' }
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <UserAvatar name={sub.user.name} handle={sub.user.handle} src={sub.user.avatar} size="md" premium={sub.active} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">@{sub.user.handle}</p>
        <p className="truncate text-xs text-muted-foreground">
          {PREMIUM_PROVIDER_LABEL[sub.provider] ?? sub.provider} · {sub.plan}
          {sub.currentPeriodEnd ? ` · vence ${new Date(sub.currentPeriodEnd).toLocaleDateString('es')}` : ' · sin caducidad'}
          {sub.cancelAtPeriodEnd ? ' · no se renueva' : ''}
        </p>
        {sub.note && <p className="truncate text-[11px] text-muted-foreground/80">"{sub.note}"</p>}
      </div>
      <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold', status.cls)}>{status.label}</span>
      {sub.active && sub.provider !== 'stripe' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" disabled={revoking} className="h-8 gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-semibold text-[#ff8080] hover:bg-destructive/15">
              <XCircle className="h-3.5 w-3.5" /> Retirar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-[#121410]">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Retirar el Premium de @{sub.user.handle}?</AlertDialogTitle>
              <AlertDialogDescription>Pierde el acceso de inmediato. Esto no reembolsa ningún pago.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onRevoke} className="bg-[#ff8080] text-[#171200] hover:bg-[#ff9999]">
                Retirar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {sub.active && sub.provider === 'stripe' && (
        <span className="shrink-0 text-[11px] text-muted-foreground">Se cancela desde Stripe</span>
      )}
    </div>
  )
}

function AdminAffiliates({ enabled }: { enabled: boolean }) {
  const list = useAdminAffiliates(enabled)
  const create = useAdminCreateAffiliate(enabled)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')

  const addPlatform = () => {
    if (!newName.trim()) {
      toast.error('Ponle un nombre a la plataforma')
      return
    }
    create.mutate(
      { name: newName.trim(), url: newUrl.trim() || undefined },
      { onSuccess: () => {
          setNewName('')
          setNewUrl('')
        } }
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Define tus plataformas de trading como afiliado. Pega el <span className="font-semibold text-foreground">enlace de referido DE LA RED</span> que
        corresponda en cada plataforma: la comunidad es redirigida allí al presionar “Comprar”, con el contrato del token ya inyectado.
      </p>

      <div className="rounded-xl border border-[#8FA83F]/25 bg-[#8FA83F]/6 px-3.5 py-2.5">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground/80">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            Usa <code className="rounded bg-black/30 px-1 font-mono text-primary">{'{ca}'}</code> donde va el contrato: se reemplaza solo al abrir.
            Ejemplos — GMGN Solana:{' '}
            <code className="rounded bg-black/30 px-1 font-mono text-primary">https://gmgn.ai/sol/token/TUCODIGO_&#123;ca&#125;</code> · Axiom BNB:{' '}
            <code className="rounded bg-black/30 px-1 font-mono text-primary">https://axiom.trade/t/&#123;ca&#125;/@usuario?chain=bnb</code>. El enlace
            madre general (ej. <code className="rounded bg-black/30 px-1 font-mono text-primary">https://axiom.trade/@usuario</code>) se usa cuando no
            hay enlace de la red del token.
          </span>
        </p>
      </div>

      {list.isLoading && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      <div className="space-y-2">
        {(list.data ?? []).map((p, i) => (
          <AffiliateRow key={p.id} platform={p} enabled={enabled} primary={i === 0} />
        ))}
        {!list.isLoading && (list.data ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-white/12 py-6 text-center text-xs text-muted-foreground">
            Aún no hay plataformas. Añade la primera abajo.
          </p>
        )}
      </div>

      {/* Añadir plataforma */}
      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Añadir plataforma</p>
        <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre (ej: Photon)"
            aria-label="Nombre de la plataforma"
            className="h-9 bg-[#121410] text-[13px]"
          />
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://…/?ref=TU_CODIGO"
            inputMode="url"
            spellCheck={false}
            aria-label="Enlace de referido"
            className="h-9 bg-[#121410] font-mono text-[12px]"
          />
          <Button
            onClick={addPlatform}
            disabled={create.isPending || !newName.trim()}
            className="h-9 gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
      </div>
    </div>
  )
}

/** bps ↔ porcentaje que ve el admin (37 bps = 0.37%). */
const bpsToPct = (bps: number) => (bps / 100).toString()
const pctToBps = (pct: string) => Math.round(Number(pct) * 100)

function AdminSwapFees({ enabled }: { enabled: boolean }) {
  const list = useAdminSwapFees(enabled)

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Comisión que cobra Cabal cuando alguien compra o vende un token sin salir de la plataforma, red por red. Solana
        (vía Jupiter) y la compra en Ethereum/Base/BNB Chain/Robinhood Chain/Arc (vía 0x) ya están integradas; Tron queda
        lista para cuando se agregue su aggregator.
      </p>

      <div className="rounded-xl border border-[#8FA83F]/25 bg-[#8FA83F]/6 px-3.5 py-2.5">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground/80">
          <Percent className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-semibold text-foreground">Comisión mínima:</span> por debajo del monto que pongas en
            &quot;operación chiquita&quot;, se cobra la comisión mínima en vez de la estándar — así una compra de $2 no
            paga lo mismo, en proporción, que una de $500. Es lo mismo que hace FOMO. Pon el umbral en 0 para desactivarlo
            y cobrar siempre la comisión estándar.
          </span>
        </p>
      </div>

      {list.isLoading && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      <div className="space-y-3">
        {(list.data ?? []).map((cfg) => (
          <SwapFeeRow key={cfg.network} config={cfg} enabled={enabled} />
        ))}
      </div>
    </div>
  )
}

function SwapFeeRow({ config, enabled }: { config: SwapFeeConfigDTO; enabled: boolean }) {
  const save = useAdminSaveSwapFee(enabled)
  const [draft, setDraft] = useState(config)
  const meta = networkMeta(config.network)
  const dirty = JSON.stringify(draft) !== JSON.stringify(config)
  // En Solana, quien cobra de verdad es la cuenta de referido de Jupiter — la
  // wallet es solo informativa. En EVM (Ethereum/Base/BNB Chain/Robinhood
  // Chain) es al revés: 0x no tiene "cuenta de referido", cobra directo a
  // esta wallet (swapFeeRecipient), así que aquí SÍ hace falta que sea una
  // dirección real.
  const isEvm = config.network === 'ethereum' || config.network === 'base' || config.network === 'bsc' || config.network === 'robinhood' || config.network === 'arc'

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <NetworkIcon network={config.network} className="h-5 w-5" />
          <span className="font-bold">{meta.label}</span>
        </div>
        <ChipToggle label={draft.enabled ? 'Cobrando comisión' : 'Sin comisión'} checked={draft.enabled} onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))} />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Comisión estándar (%)</Label>
          <Input
            type="number"
            min={0}
            max={10}
            step={0.01}
            value={bpsToPct(draft.feeBps)}
            onChange={(e) => setDraft((d) => ({ ...d, feeBps: pctToBps(e.target.value) }))}
            className="mt-1 h-9 bg-[#121410] text-[13px]"
          />
        </div>
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operación chiquita, bajo (USD)</Label>
          <Input
            type="number"
            min={0}
            max={10000}
            value={draft.smallTradeUsd}
            onChange={(e) => setDraft((d) => ({ ...d, smallTradeUsd: Number(e.target.value) }))}
            className="mt-1 h-9 bg-[#121410] text-[13px]"
          />
        </div>
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Comisión mínima (%)</Label>
          <Input
            type="number"
            min={0}
            max={10}
            step={0.01}
            value={bpsToPct(draft.smallTradeFeeBps)}
            onChange={(e) => setDraft((d) => ({ ...d, smallTradeFeeBps: pctToBps(e.target.value) }))}
            className="mt-1 h-9 bg-[#121410] text-[13px]"
          />
        </div>
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Wallet de cobro {isEvm ? '(la comisión cae aquí de verdad)' : '(informativo)'}
          </Label>
          <Input
            value={draft.feeWallet}
            onChange={(e) => setDraft((d) => ({ ...d, feeWallet: e.target.value }))}
            placeholder={isEvm ? 'Dirección EVM (0x...) donde 0x deposita la comisión' : 'Dirección de la wallet'}
            spellCheck={false}
            className="mt-1 h-9 bg-[#121410] font-mono text-[12px]"
          />
        </div>
        {!isEvm && (
          <div className="sm:col-span-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cuenta de referido (Jupiter u otro aggregator)</Label>
            <Input
              value={draft.referralAccount}
              onChange={(e) => setDraft((d) => ({ ...d, referralAccount: e.target.value }))}
              placeholder="Dirección de la cuenta de referido"
              spellCheck={false}
              className="mt-1 h-9 bg-[#121410] font-mono text-[12px]"
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nota para la comunidad</Label>
          <Input
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="Ej: Disfruta comisiones bajas en tokens blue chip. En operaciones chiquitas se cobra una comisión mínima para cubrir costos de blockchain."
            className="mt-1 h-9 bg-[#121410] text-[12px]"
          />
        </div>
      </div>

      <Button
        onClick={() => save.mutate(draft, { onSuccess: (res) => setDraft(res.config) })}
        disabled={!dirty || save.isPending}
        size="sm"
        className="mt-3 h-8 gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F] disabled:opacity-40"
      >
        <Save className="h-3.5 w-3.5" /> Guardar {meta.label}
      </Button>
    </div>
  )
}

function AffiliateRow({
  platform,
  enabled,
  primary,
}: {
  platform: AffiliatePlatformDTO
  enabled: boolean
  primary: boolean
}) {
  const save = useAdminSaveAffiliate(enabled)
  const remove = useAdminDeleteAffiliate(enabled)
  const [name, setName] = useState(platform.name)
  const [url, setUrl] = useState(platform.url)
  const [links, setLinks] = useState<Record<string, string>>(platform.links ?? {})
  const dirty =
    name !== platform.name || url !== platform.url || AFFILIATE_NETWORKS.some((n) => (links[n] ?? '') !== (platform.links?.[n] ?? ''))

  const setLink = (network: string, v: string) => setLinks((f) => ({ ...f, [network]: v }))

  const saveAll = () => save.mutate({ id: platform.id, name, url, links })

  return (
    <div className={cn('rounded-xl border bg-[#0a0b08] p-3', platform.active ? 'border-[#8FA83F]/30' : 'border-white/10')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-machina w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">{primary ? '1' : ''}</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={`Nombre de ${platform.name}`}
          className="h-9 w-36 shrink-0 bg-[#121410] text-[13px] font-bold"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enlace madre general · https://axiom.trade/@usuario (opcional)"
          inputMode="url"
          spellCheck={false}
          aria-label={`Enlace madre general de ${platform.name}`}
          className="h-9 min-w-[180px] flex-1 bg-[#121410] font-mono text-[12px]"
        />
        <ChipToggle
          label={platform.active ? 'Activa' : 'Inactiva'}
          checked={platform.active}
          onChange={(v) => save.mutate({ id: platform.id, name, url, links, active: v })}
        />
        {dirty && (
          <Button
            size="sm"
            onClick={saveAll}
            disabled={save.isPending}
            className="h-9 gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
          >
            <Save className="h-3.5 w-3.5" /> Guardar
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={enabled === false}
              className="h-9 w-9 shrink-0 rounded-lg p-0 text-muted-foreground hover:text-[#ff8080]"
              aria-label={`Eliminar ${platform.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-[#121410]">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar {platform.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Los botones “Comprar” dejarán de llevar a esta plataforma. Puedes volver a añadirla después.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => remove.mutate(platform.id)}
                className="bg-[#ff4d5e] text-white hover:bg-[#ff6675]"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Enlaces de referido DE LA RED {red}: uno por cadena, con soporte {ca} */}
      <p className="mb-1.5 mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Globe className="h-3 w-3" aria-hidden /> Enlace de referido DE LA RED — pega el de cada cadena (usa{' '}
        <code className="rounded bg-black/30 px-1 font-mono text-primary">{'{ca}'}</code> donde va el contrato)
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {AFFILIATE_NETWORKS.map((n) => {
          const meta = NETWORKS[n]
          return (
            <div key={n} className="flex items-center gap-1.5">
              <span
                className="flex h-9 w-[104px] shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-[#121410] px-2 text-[10px] font-bold text-muted-foreground"
                title={`Enlace de ${platform.name} DE LA RED ${meta.label}`}
              >
                <NetworkIcon network={n} className="h-3 w-3" />
                {meta.label}
              </span>
              <Input
                value={links[n] ?? ''}
                onChange={(e) => setLink(n, e.target.value)}
                placeholder={NETWORK_PLACEHOLDER[n]}
                inputMode="url"
                spellCheck={false}
                aria-label={`Enlace de ${platform.name} DE LA RED ${meta.label}`}
                className="h-9 min-w-0 flex-1 bg-[#121410] font-mono text-[11px]"
              />
            </div>
          )
        })}
      </div>

      {platform.active && (
        <p className="mt-1.5 truncate pl-1 text-[10px] text-muted-foreground">
          Ejemplo redirección (Solana):{' '}
          <span className="font-mono text-primary/90">
            {platformLinkFor({ url, links }, 'solana', '2oFGkSFgkHS65ejE8eGU5nC749yw6UvmWQe9eNyspump') ?? '— pega un enlace arriba —'}
          </span>
        </p>
      )}
    </div>
  )
}

function AdminTokenRow({ token, enabled }: { token: TokenDTO; enabled: boolean }) {
  const updateToken = useAdminUpdateToken(enabled)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: token.name,
    ticker: token.ticker,
    network: token.network,
    image: token.image ?? '',
    price: String(token.price),
    mc: String(token.mc),
    change24h: String(token.change24h),
    volume24h: String(token.volume24h),
    holders: String(token.holders),
    top10Pct: String(token.top10Pct),
    isRug: token.isRug,
    verified: token.verifiedSelf ?? false,
  })
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    updateToken.mutate(
      {
        id: token.id,
        name: form.name,
        ticker: form.ticker,
        network: form.network,
        image: form.image,
        price: Number(form.price) || 0,
        mc: Number(form.mc) || 0,
        change24h: Number(form.change24h) || 0,
        volume24h: Number(form.volume24h) || 0,
        holders: Math.max(0, Math.round(Number(form.holders) || 0)),
        top10Pct: Math.max(0, Math.min(100, Math.round(Number(form.top10Pct) || 0))),
        isRug: form.isRug,
        verified: form.verified,
      },
      { onSuccess: () => setEditing(false) }
    )
  }

  const numField = (key: keyof typeof form, label: string, step = 'any') => (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value)}
        className="h-8 bg-[#0a0b08] font-mono text-[13px]"
      />
    </div>
  )

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <TokenGlyph src={token.image} ticker={token.ticker} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {token.name} <span className="font-mono text-xs text-primary">${token.ticker}</span>
            {token.isRug && <span className="ml-1.5 rounded bg-[#ff4d5e]/12 px-1 py-px text-[9px] font-black uppercase text-[#ff8080]">Rug</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {NETWORKS[token.network as keyof typeof NETWORKS]?.label ?? token.network} · ${token.mc.toLocaleString('es')} MC · {token.change24h > 0 ? '+' : ''}{token.change24h}% 24h
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing((v) => !v)}
          className="h-8 gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3 w-3" /> {editing ? 'Cerrar' : 'Editar'}
        </Button>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 rounded-lg border border-white/8 bg-[#121410] p-3">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <ImageDrop
              url={form.image}
              onSelect={async (file) => {
                try {
                  const url = await uploadImage(file)
                  set('image', url)
                } catch (e) {
                  toast.error((e as Error).message)
                }
              }}
              onPickUrl={(u) => set('image', u)}
              onRemove={() => set('image', '')}
              aspect="square"
              label="Logo del token"
              hint="Subir logo"
            />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nombre</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="h-8 bg-[#0a0b08] text-[13px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ticker</Label>
                <Input value={form.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())} className="h-8 bg-[#0a0b08] font-mono text-[13px]" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Red</Label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(NETWORKS).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => set('network', key)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold',
                        form.network === key ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground'
                      )}
                    >
                      <NetworkIcon network={key} className="h-3 w-3" />
                      {meta.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {numField('price', 'Precio USD')}
            {numField('mc', 'Market cap')}
            {numField('change24h', 'Cambio 24h %')}
            {numField('volume24h', 'Volumen 24h')}
            {numField('holders', 'Holders', '1')}
            {numField('top10Pct', 'Top10 %', '1')}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <ChipToggle label="Marcado como rug" checked={form.isRug} onChange={(v) => set('isRug', v)} okIcon={false} />
            <ChipToggle label="Token oficial (verificado)" checked={form.verified} onChange={(v) => set('verified', v)} />
            <Button
              size="sm"
              onClick={save}
              disabled={updateToken.isPending}
              className="h-8 gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
            >
              <Save className="h-3.5 w-3.5" /> {updateToken.isPending ? 'Guardando…' : 'Guardar token'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

// ── Reclamos de proyectos: cola de aprobación ─────────────────────────────
// Los usuarios reclaman la propiedad de un launch/token por CA + wallet.
// Solana se verifica on-chain automáticamente; el resto queda pendiente y el
// admin aprueba o rechaza desde aquí.
type AdminClaimRow = ProjectClaimDTO & {
  userName: string
  userHandle: string
  projectName: string
  projectTicker: string | null
}

const ADMIN_CLAIM_STATUS: Record<string, { label: string; cls: string }> = {
  verified: { label: 'VERIFICADO', cls: 'border-[#8FA83F]/40 bg-[#8FA83F]/12 text-primary' },
  pending: { label: 'PENDIENTE', cls: 'border-white/15 bg-white/5 text-muted-foreground' },
  rejected: { label: 'RECHAZADO', cls: 'border-[#ff8080]/30 bg-[#ff8080]/10 text-[#ff8080]' },
}

function AdminCalls({ enabled }: { enabled: boolean }) {
  const callsQ = useAdminCalls(enabled)
  const backfill = useAdminBackfillCallEntry()
  const leaderboard = callsQ.data?.leaderboard ?? []
  const calls = callsQ.data?.calls ?? []

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Últimas {calls.length} calls públicas del feed, con su %s en vivo desde que se publicaron (comparado contra el
        precio actual). El winrate y el %s promedio solo cuentan las calls con dato de precio.
      </p>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
        <p className="text-[11px] text-muted-foreground">
          Las calls de antes de este cambio no tenían guardado el precio exacto de entrada. Este botón lo reconstruye
          una vez (por velas históricas) y lo deja fijo, para que dejen de recalcularse en cada carga.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={backfill.isPending}
          onClick={() => backfill.mutate()}
        >
          {backfill.isPending ? 'Rellenando…' : 'Rellenar calls antiguas'}
        </Button>
      </div>

      {callsQ.isLoading && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}

      {!callsQ.isLoading && leaderboard.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay calls publicadas
        </p>
      )}

      {leaderboard.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
          <p className="pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Winrate por usuario
          </p>
          <div className="space-y-1.5">
            {leaderboard.map((row) => (
              <div key={row.user.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/4">
                <UserAvatar name={row.user.name} handle={row.user.handle} src={row.user.avatar} size="xs" ring={false} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{row.user.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {row.total} call{row.total === 1 ? '' : 's'}
                </span>
                <span className="text-[11px] font-bold text-primary">
                  {row.winRate === null ? '—' : `${row.winRate}% winrate`}
                </span>
                <span className={cn('w-16 text-right font-mono text-[12px] font-bold', (row.avgPct ?? 0) >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
                  {row.avgPct === null ? '—' : fmtPct(row.avgPct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Detalle de calls</p>
        {calls.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <UserAvatar name={c.user.name} handle={c.user.handle} src={c.user.avatar} size="xs" ring={false} />
                <span className="truncate text-[13px] font-bold">@{c.user.handle}</span>
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <NetworkIcon network={c.network ?? 'solana'} className="h-3 w-3" />
                  {c.symbol ? `$${c.symbol}` : ''}
                </span>
              </div>
              <span className="flex items-center gap-2">
                {c.pctChange !== null ? (
                  <span className={cn('flex items-center gap-1 text-[12px] font-bold', c.pctChange >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
                    <TrendingUp className={cn('h-3 w-3', c.pctChange < 0 && 'rotate-180')} />
                    {fmtPct(c.pctChange)}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">sin datos</span>
                )}
                <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] text-foreground/85">{c.content}</p>
            {c.contract && <CopyCA contract={c.contract} className="mt-1.5 text-[10px]" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Moderación del feed: tesis y comentarios, con borrado directo ────────
const MODERATION_KIND_LABEL: Record<string, string> = { thesis: 'Tesis', comment: 'Comentario' }

function AdminModeration({ enabled }: { enabled: boolean }) {
  const [kind, setKind] = useState<'thesis' | 'comment' | undefined>(undefined)
  const postsQ = useAdminPosts(enabled, kind)
  const deletePost = useAdminDeletePost(enabled)
  const posts = postsQ.data?.posts ?? []

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Todas las tesis y comentarios del feed (últimos 300). Bórralos aquí si el contenido es inadecuado.
      </p>

      <div className="flex gap-1.5">
        {(
          [
            { key: undefined, label: 'Todo' },
            { key: 'thesis', label: 'Tesis' },
            { key: 'comment', label: 'Comentarios' },
          ] as { key: 'thesis' | 'comment' | undefined; label: string }[]
        ).map((f) => (
          <button
            key={f.label}
            onClick={() => setKind(f.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-bold transition-all',
              kind === f.key
                ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {postsQ.isLoading && [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}

      {!postsQ.isLoading && posts.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-muted-foreground">
          No hay nada que moderar por ahora
        </p>
      )}

      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <UserAvatar name={p.user.name} handle={p.user.handle} src={p.user.avatar} size="xs" ring={false} />
                <span className="truncate text-[13px] font-bold">@{p.user.handle}</span>
                <span className="rounded bg-white/8 px-1 py-px text-[9px] font-black uppercase text-zinc-300">
                  {MODERATION_KIND_LABEL[p.kind] ?? p.kind}
                </span>
                {(p.launchName || p.tokenName) && (
                  <span className="truncate text-[10px] text-muted-foreground">en {p.launchName ?? p.tokenName}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{timeAgo(p.createdAt)}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={deletePost.isPending}
                      className="h-8 w-8 rounded-lg border border-white/10 text-[#ff8080] hover:bg-destructive/15"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/12 bg-[#121410]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display">¿Eliminar este {MODERATION_KIND_LABEL[p.kind]?.toLowerCase() ?? 'post'}?</AlertDialogTitle>
                      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deletePost.mutate(p.id)}
                        className="bg-[#ff4d5e] text-white hover:bg-[#ff4d5e]/85"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-foreground/85">{p.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminClaims({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient()
  const claimsQ = useQuery<{ claims: AdminClaimRow[] }>({
    queryKey: ['admin', 'claims'] as const,
    queryFn: () => jsonFetch('/api/admin/claims'),
    enabled,
  })

  const act = useMutation({
    mutationFn: (data: { id: string; action: 'approve' | 'reject' }) =>
      jsonFetch<{ ok: boolean }>('/api/admin/claims', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries()
      toast.success(vars.action === 'approve' ? 'Reclamo aprobado · proyecto vinculado al usuario' : 'Reclamo rechazado')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const claims = claimsQ.data?.claims ?? []
  const pending = claims.filter((c) => c.status === 'pending').length

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Reclamos de propiedad de proyectos. Solana se verifica solo (mint authority / creador);
        las demás redes requieren tu aprobación manual.
        {pending > 0 && <span className="ml-1 font-bold text-primary">{pending} pendiente{pending === 1 ? '' : 's'}</span>}
      </p>

      {claimsQ.isLoading && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}

      {!claimsQ.isLoading && claims.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay reclamos de proyectos
        </p>
      )}

      {claims.map((c) => {
        const meta = ADMIN_CLAIM_STATUS[c.status] ?? ADMIN_CLAIM_STATUS.pending
        return (
          <div key={c.id} className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold">
                  <span className="truncate">{c.projectName}</span>
                  {c.projectTicker && (
                    <span className="font-mono text-[11px] font-normal text-muted-foreground">${c.projectTicker}</span>
                  )}
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-normal text-muted-foreground">
                    <NetworkIcon network={c.network} className="h-3 w-3" />
                    {NETWORKS[c.network as keyof typeof NETWORKS]?.label ?? c.network}
                  </span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  por {c.userName} (@{c.userHandle}) · {timeAgo(c.createdAt)}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground/80">CA: {c.contract}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground/80">Wallet: {c.wallet}</p>
                {c.note && <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/70">{c.note}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider', meta.cls)}>
                  {meta.label}
                </span>
                {c.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => act.mutate({ id: c.id, action: 'approve' })}
                      disabled={act.isPending}
                      className="h-8 gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground hover:bg-[#8FA83F]"
                    >
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act.mutate({ id: c.id, action: 'reject' })}
                      disabled={act.isPending}
                      className="h-8 gap-1 rounded-lg border border-[#ff8080]/30 px-2.5 text-[11px] font-bold text-[#ff8080] hover:bg-[#ff8080]/10"
                    >
                      <XCircle className="h-3 w-3" aria-hidden /> Rechazar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const VERIFY_STATUS: Record<string, { label: string; cls: string }> = {
  approved: { label: 'APROBADA', cls: 'border-[#7fe04a]/40 bg-[#7fe04a]/10 text-[#a6f27a]' },
  pending: { label: 'PENDIENTE', cls: 'border-white/15 bg-white/5 text-muted-foreground' },
  rejected: { label: 'RECHAZADA', cls: 'border-[#ff8080]/30 bg-[#ff8080]/10 text-[#ff8080]' },
}

/**
 * Solicitudes de verificación de usuarios Premium (perfil o launch). Aprobar
 * da la insignia mientras sigan en Premium; para verificar a alguien sin
 * solicitud, o de forma permanente, está el interruptor "Verificado" de su
 * ficha en Usuarios / Proyectos / Tokens.
 */
function AdminVerification({ enabled }: { enabled: boolean }) {
  const q = useAdminVerifyRequests(enabled)
  const act = useAdminReviewVerification()
  const rows = q.data ?? []
  const pending = rows.filter((r) => r.status === 'pending').length

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Solicitudes de verificación de usuarios Premium. Revisa las pruebas antes de aprobar: la insignia marca el perfil
        o el launch como oficial frente a clones y se apaga sola si dejan de pagar. Para verificar de forma permanente,
        usa el interruptor en su ficha de Usuarios, Proyectos o Tokens.
        {pending > 0 && <span className="ml-1 font-bold text-primary">{pending} pendiente{pending === 1 ? '' : 's'}</span>}
      </p>

      {q.isLoading && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}

      {!q.isLoading && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay solicitudes de verificación
        </p>
      )}

      {rows.map((r) => {
        const meta = VERIFY_STATUS[r.status] ?? VERIFY_STATUS.pending
        return (
          <div key={r.id} className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold">
                  {r.kind === 'launch' ? (
                    <>
                      <Rocket className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      <span className="truncate">Launch: {r.launch?.name ?? '(borrado)'}</span>
                      {r.launch?.ticker && (
                        <span className="font-mono text-[11px] font-normal text-muted-foreground">${r.launch.ticker}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <Users className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      <span className="truncate">Perfil</span>
                    </>
                  )}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  por{' '}
                  <a href={`/u/${r.user?.handle}`} target="_blank" rel="noreferrer" className="hover:underline">
                    {r.user?.name} (@{r.user?.handle})
                  </a>{' '}
                  · {timeAgo(r.createdAt)}
                </p>
                {r.note && <p className="mt-0.5 break-words text-[11px] leading-relaxed text-foreground/75">{r.note}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider', meta.cls)}>
                  {meta.label}
                </span>
                {r.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => act.mutate({ id: r.id, action: 'approve' })}
                      disabled={act.isPending}
                      className="h-8 gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground hover:bg-[#8FA83F]"
                    >
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act.mutate({ id: r.id, action: 'reject' })}
                      disabled={act.isPending}
                      className="h-8 gap-1 rounded-lg border border-[#ff8080]/30 px-2.5 text-[11px] font-bold text-[#ff8080] hover:bg-[#ff8080]/10"
                    >
                      <XCircle className="h-3 w-3" aria-hidden /> Rechazar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
