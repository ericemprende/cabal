'use client'

import { useState } from 'react'
import {
  AtSign,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Copy,
  Flame,
  Gift,
  GraduationCap,
  Heart,
  KeyRound,
  Mail,
  MessageSquare,
  RefreshCw,
  Rocket,
  Wallet,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { PointsPill, UserAvatar } from '@/components/cabal/shared'
import { timeAgo } from '@/lib/cabal'
import { useAuthStatus, useMe, useUpdateMe, useVerifyProvider, type AuthStatusDTO } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { OAuthConsentDialog } from '@/components/cabal/oauth-consent-dialog'

const REASON_META: Record<string, { label: string; icon: typeof Zap }> = {
  thesis: { label: 'Tesis publicada', icon: GraduationCap },
  comment: { label: 'Comentario', icon: MessageSquare },
  launch: { label: 'Launch publicado', icon: Rocket },
  like_received: { label: 'Likes recibidos', icon: Heart },
  hype_received: { label: 'Hype recibido', icon: Flame },
  daily_visit: { label: 'Visita diaria', icon: CalendarDays },
  admin_adjust: { label: 'Bonus del Cabal', icon: Gift },
  redeem: { label: 'Canje', icon: RefreshCw },
  verify_x: { label: 'Cuenta de X verificada', icon: AtSign },
  verify_google: { label: 'Cuenta de Google verificada', icon: Mail },
}

export function ProfileDialog() {
  const { profileOpen, setProfileOpen } = useUI()
  const { data: me } = useMe()

  return (
    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-lg" aria-describedby={undefined}>
        {me && <ProfileContent me={me} />}
      </DialogContent>
    </Dialog>
  )
}

function ProfileContent({ me }: { me: NonNullable<ReturnType<typeof useMe>['data']> }) {
  const { setProfileOpen } = useUI()
  const updateMe = useUpdateMe()
  const { data: authStatus } = useAuthStatus()
  const [consent, setConsent] = useState<'x' | 'google' | null>(null)
  const [name, setName] = useState(me.name)
  const [bio, setBio] = useState(me.bio ?? '')
  const [wallet, setWallet] = useState(me.wallet ?? '')

  /** CTA de conexión: OAuth real si hay credenciales, consentimiento demo si no. */
  const connect = (provider: 'x' | 'google') => {
    if (authStatus?.[provider]?.configured) {
      window.location.assign(`/api/auth/${provider}/start`)
    } else {
      setConsent(provider)
    }
  }

  const save = () => {
    updateMe.mutate({
      name,
      bio,
      avatar: me.avatar,
      wallet: wallet.trim() && wallet.trim().length >= 20 ? wallet.trim() : (me.wallet ?? ''),
    })
    setProfileOpen(false)
  }

  return (
    <>
        <div className="relative border-b border-white/10 p-5">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#8FA83F]/8 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <UserAvatar name={me?.name} handle={me?.handle} size="xl" verified={me?.walletVerified} />
            <div className="min-w-0">
              <DialogTitle className="font-display truncate text-xl font-bold">{me?.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">@{me?.handle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PointsPill points={me?.points ?? 0} />
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground">
                  Rank #{me?.pointsRank} por puntos
                </span>
                {me?.isAdmin && (
                  <span className="rounded-full bg-[#8FA83F]/12 px-2 py-0.5 text-[11px] font-bold text-primary">ADMIN</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 border-b border-white/10 p-4">
          <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label="Posts" value={me?.stats.postsCount ?? 0} />
          <Stat icon={<Rocket className="h-3.5 w-3.5" />} label="Launches" value={me?.stats.launchesCount ?? 0} />
          <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Hypes" value={me?.stats.hypesGiven ?? 0} />
          <Stat icon={<Zap className="h-3.5 w-3.5" />} label="Lifetime" value={me?.lifetimePoints ?? 0} />
        </div>

        {/* Points wallet */}
        <div className="border-b border-white/10 p-4">
          <div className="rounded-xl border border-[#8FA83F]/20 bg-gradient-to-br from-[#8FA83F]/10 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Balance de puntos Cabal</p>
                <p className="font-machina mt-1 flex items-center gap-2 text-3xl font-bold text-primary">
                  {(me?.points ?? 0).toLocaleString('es')}
                  <Zap className="h-5 w-5 text-primary/80" aria-hidden />
                </p>
              </div>
              <Gift className="h-10 w-10 text-primary/30" aria-hidden />
            </div>
            <p className="mt-2.5 rounded-lg bg-[#0a0b08]/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Cuando lancemos <span className="font-bold text-primary">$CABAL</span>, tus puntos se canjean por tokens del airdrop comunitario. 1 punto = 1 cupo del pool comunitario.
            </p>
          </div>

          {/* history */}
          <p className="pb-1.5 pt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Historial de puntos</p>
          <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {(me?.pointEvents ?? []).length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Publica tesis o launches para ganar puntos</p>
            )}
            {(me?.pointEvents ?? []).map((e) => {
              const meta = REASON_META[e.reason]
              const Icon = meta?.icon ?? Zap
              return (
                <div key={e.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/5 text-zinc-400" aria-hidden>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{e.note ?? meta?.label ?? e.reason}</p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo(e.createdAt)}</p>
                  </div>
                  <span className={cn('font-mono text-[13px] font-bold', e.amount >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
                    {e.amount >= 0 ? '+' : ''}{e.amount}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Conexiones: X y Google (OAuth 2.0 real con fallback demo) */}
        <div className="space-y-2 border-b border-white/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conexiones y verificación</p>
          <ConnectionRow
            icon={<AtSign className="h-4 w-4" />}
            title="Cuenta de X"
            subtitle="Verifica tu identidad con tu cuenta de X · +5 puntos"
            verified={me?.xVerified ?? false}
            verifiedLabel={me?.xHandle ? `@${me.xHandle}` : 'Verificada'}
            provider="x"
            cta="Conectar con X"
            configured={authStatus?.x.configured ?? false}
            onConnect={() => connect('x')}
          />
          <ConnectionRow
            icon={<Mail className="h-4 w-4" />}
            title="Cuenta de Google"
            subtitle="Confirma tu email con Google · +5 puntos"
            verified={me?.googleVerified ?? false}
            verifiedLabel={me?.googleEmail ?? 'Verificada'}
            provider="google"
            cta="Conectar con Google"
            configured={authStatus?.google.configured ?? false}
            onConnect={() => connect('google')}
          />
          <ApiSetupHelp status={authStatus} />
        </div>

        {/* Edit profile */}
        <div className="space-y-3.5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Editar perfil</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-name" className="text-xs text-muted-foreground">Nombre</Label>
              <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 bg-[#0a0b08]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-wallet" className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wallet className="h-3 w-3" /> Wallet {me?.walletVerified && <BadgeCheck className="h-3 w-3 text-primary" />}
              </Label>
              <Input
                id="pf-wallet"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="Conecta tu wallet (0x…)"
                className="h-9 bg-[#0a0b08] font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-bio" className="text-xs text-muted-foreground">Bio</Label>
            <Textarea id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[56px] resize-none bg-[#0a0b08]" />
          </div>
          <Button
            onClick={save}
            disabled={updateMe.isPending}
            className="h-10 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-[#8FA83F]"
          >
            {updateMe.isPending ? 'Guardando…' : 'Guardar perfil'}
          </Button>
        </div>

      {/* Pantalla de consentimiento simulada (modo demo, sin API keys) */}
      <OAuthConsentDialog provider={consent} appName="Cabal" onOpenChange={(o) => !o && setConsent(null)} />
    </>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0b08] px-2.5 py-2 text-center">
      <div className="mx-auto flex w-fit items-center gap-1 text-zinc-400">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
    </div>
  )
}

// Fila de conexión con proveedor externo (X / Google)
// - Con API keys: redirige al flujo OAuth 2.0 real del proveedor.
// - Sin API keys: abre la pantalla de consentimiento simulada (demo).
function ConnectionRow({
  icon,
  title,
  subtitle,
  verified,
  verifiedLabel,
  provider,
  cta,
  configured,
  onConnect,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  verified: boolean
  verifiedLabel: string
  provider: 'x' | 'google'
  cta: string
  configured: boolean
  onConnect: () => void
}) {
  const verify = useVerifyProvider()

  if (verified) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#8FA83F]/20 bg-[#8FA83F]/6 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#8FA83F]/25 bg-[#8FA83F]/10 text-primary" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-bold">
            {title}
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verificada" />
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{verifiedLabel}</p>
        </div>
        <button
          onClick={() => verify.mutate({ provider, disconnect: true })}
          disabled={verify.isPending}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-[#ff8080]"
        >
          Desconectar
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-bold">
            {title}
            <span
              className={cn(
                'rounded px-1 py-px text-[9px] font-black tracking-wide',
                configured ? 'bg-[#8FA83F]/15 text-primary' : 'bg-white/8 text-zinc-400'
              )}
            >
              {configured ? 'OAUTH 2.0' : 'DEMO'}
            </span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={onConnect}
          className="h-8 shrink-0 rounded-lg border border-[#8FA83F]/35 bg-[#8FA83F]/10 px-3 text-xs font-bold text-primary hover:bg-[#8FA83F]/20 hover:text-primary"
          variant="ghost"
        >
          {cta}
        </Button>
      </div>
      {!configured && (
        <p className="mt-2 pl-12 text-[10px] leading-relaxed text-muted-foreground/70">
          Sin credenciales del proveedor: se abre una pantalla de autorización simulada.
          Configura las API keys para usar el OAuth real.
        </p>
      )}
    </div>
  )
}

/** Guía plegable para configurar las credenciales OAuth reales. */
function ApiSetupHelp({ status }: { status: AuthStatusDTO | undefined }) {
  const [open, setOpen] = useState(false)

  const copy = (url: string | undefined, label: string) => {
    if (!url) return
    navigator.clipboard?.writeText(url).then(
      () => toast.success(`${label} copiada`),
      () => toast.error('No se pudo copiar')
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0f0b]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold text-zinc-300">
          <KeyRound className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          Conectar las APIs reales (OAuth 2.0)
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/10 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
          {/* X */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-zinc-200">X (Twitter)</p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>
                En <span className="font-mono text-zinc-300">developer.x.com</span> crea un Project + App y
                activa <span className="text-zinc-300">User authentication settings</span> → OAuth 2.0 → Web App.
              </li>
              <li>Registra esta Callback URI:</li>
            </ol>
            <CallbackUrl url={status?.x.callbackUrl} onCopy={() => copy(status?.x.callbackUrl, 'Callback URI de X')} />
            <p>
              Guarda las variables de entorno{' '}
              <span className="font-mono text-zinc-300">X_CLIENT_ID</span> y{' '}
              <span className="font-mono text-zinc-300">X_CLIENT_SECRET</span>.
            </p>
          </div>

          {/* Google */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-zinc-200">Google</p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>
                En <span className="font-mono text-zinc-300">console.cloud.google.com</span> configura la pantalla
                de consentimiento (Externa) y crea credenciales → ID de cliente OAuth → Aplicación web.
              </li>
              <li>Registra esta URI de redirección autorizada:</li>
            </ol>
            <CallbackUrl
              url={status?.google.callbackUrl}
              onCopy={() => copy(status?.google.callbackUrl, 'URI de redirección de Google')}
            />
            <p>
              Guarda <span className="font-mono text-zinc-300">GOOGLE_CLIENT_ID</span> y{' '}
              <span className="font-mono text-zinc-300">GOOGLE_CLIENT_SECRET</span>.
            </p>
          </div>

          <p className="rounded-lg bg-white/4 px-2.5 py-1.5 text-[10px]">
            Tras guardar las variables, reinicia el servidor: los botones pasarán
            automáticamente al flujo real con la pantalla oficial de X / Google.
          </p>
        </div>
      )}
    </div>
  )
}

function CallbackUrl({ url, onCopy }: { url?: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0a0b08] px-2 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-300">{url ?? 'Cargando…'}</code>
      <button
        type="button"
        onClick={onCopy}
        disabled={!url}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 text-zinc-400 transition-colors hover:text-primary"
        aria-label="Copiar URL"
      >
        <Copy className="h-3 w-3" aria-hidden />
      </button>
    </div>
  )
}
