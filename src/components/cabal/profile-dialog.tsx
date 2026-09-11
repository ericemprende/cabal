'use client'

import { useRef, useState, useEffect } from 'react'
import {
  Activity,
  AtSign,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Copy,
  Droplets,
  ExternalLink,
  Flame,
  Gift,
  GraduationCap,
  Heart,
  ImagePlus,
  KeyRound,
  Mail,
  MessageSquare,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
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
import { NETWORKS, shortWallet, timeAgo } from '@/lib/cabal'
import { PointsPill, UserAvatar, NetworkIcon } from '@/components/cabal/shared'
import {
  injectedWalletFor,
  uploadImage,
  useAddWallet,
  useAuthStatus,
  useClaimProject,
  useMe,
  useProjectClaims,
  useReferral,
  useRemoveDevToken,
  useRemoveWallet,
  useUpdateMe,
  useVerifyDevToken,
  useVerifyProvider,
  useVerifyWalletSignature,
  type AuthStatusDTO,
} from '@/lib/api-client'
import type { DevClaimDTO, MeDTO, WalletLinkDTO } from '@/lib/types'
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
  verify_wallet: { label: 'Wallet verificada con firma', icon: ShieldCheck },
  referral: { label: 'Puntos por referidos', icon: Users },
}

export function ProfileDialog() {
  const { profileOpen, setProfileOpen } = useUI()
  const { data: me } = useMe()

  return (
    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
      <DialogContent className="max-h-[88vh] grid-cols-[minmax(0,1fr)] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-lg" aria-describedby={undefined}>
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
  const [avatar, setAvatar] = useState(me.avatar)

  /** CTA de conexión: OAuth real si hay credenciales, consentimiento demo (solo en desarrollo) si no. */
  const connect = (provider: 'x' | 'google') => {
    if (authStatus?.[provider]?.configured) {
      window.location.assign(`/api/auth/${provider}/start`)
    } else if (authStatus?.[provider]?.demo) {
      setConsent(provider)
    }
  }

  const save = () => {
    updateMe.mutate({
      name,
      bio,
      avatar,
    })
    setProfileOpen(false)
  }

  return (
    <>
        <div className="relative overflow-hidden border-b border-white/10 p-5">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#8FA83F]/8 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <UserAvatar name={me?.name} handle={me?.handle} src={avatar} size="xl" verified={me?.walletVerified} />
            <div className="min-w-0">
              <DialogTitle className="font-display truncate text-xl font-bold">{me?.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">@{me?.handle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PointsPill points={me?.points ?? 0} />
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground">
                  Rank #{me?.pointsRank} por puntos
                </span>
                {me?.isDev && (
                  <span className="flex items-center gap-1 rounded-full border border-[#8FA83F]/30 bg-[#8FA83F]/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                    <ShieldCheck className="h-3 w-3" aria-hidden /> DEV
                  </span>
                )}
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

        {/* Invita y gana: código de referido */}
        <ReferralSection />

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
            demo={authStatus?.x.demo ?? false}
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
            demo={authStatus?.google.demo ?? false}
            onConnect={() => connect('google')}
          />
          <ApiSetupHelp status={authStatus} />
        </div>

        {/* Wallets conectadas + verificación de tokens como dev */}
        <div className="space-y-2.5 border-b border-white/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Wallets y track record de dev</p>
          <WalletManager me={me} />
        </div>

        {/* Opciones avanzadas: reclamar proyectos como propios */}
        <div className="space-y-2.5 border-b border-white/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Opciones avanzadas · Reclamar proyecto</p>
          <ClaimProjectSection />
        </div>

        {/* Edit profile */}
        <div className="space-y-3.5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Editar perfil</p>

          {/* Foto de perfil: subir archivo o pegar URL */}
          <AvatarEditor
            avatar={avatar}
            name={me.name}
            onApply={(url) => {
              setAvatar(url)
              updateMe.mutate({ avatar: url })
            }}
            busy={updateMe.isPending}
          />

          <div className="space-y-1.5">
            <Label htmlFor="pf-name" className="text-xs text-muted-foreground">Nombre</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 bg-[#0a0b08]" />
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

// ── Invita y gana: código de referido del usuario ──────────────────────────
// Cada persona que se registra con este código deja el points_referral_percent%
// de los puntos que genere (configurable desde el panel admin).
function ReferralSection() {
  const { data: ref } = useReferral()
  const [copied, setCopied] = useState(false)
  if (!ref) return null

  const link = ref.code ? `${window.location.origin}/app?ref=${ref.code}` : ''

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Enlace copiado')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <div className="space-y-2 border-b border-white/10 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invita y gana</p>
      <div className="rounded-xl border border-[#8FA83F]/20 bg-gradient-to-br from-[#8FA83F]/10 to-transparent p-3.5">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Comparte tu enlace: quien se registre con él te deja el{' '}
          <span className="font-bold text-primary">{ref.percent}%</span> de los puntos que genere en el Cabal.
        </p>
        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-white/10 bg-[#0a0b08] px-3">
            <span className="truncate font-mono text-xs font-bold text-primary" title={link}>
              {link ? link.replace(/^https?:\/\//, '') : '···'}
            </span>
          </div>
          <Button
            size="sm"
            onClick={copy}
            className="h-10 shrink-0 gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copied ? '¡Copiado!' : 'Copiar'}
          </Button>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invitados</p>
            <p className="text-base font-bold tabular-nums">{ref.referrals}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Puntos por referidos</p>
            <p className="text-base font-bold tabular-nums text-primary">+{ref.earned}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Opciones avanzadas: reclamar la propiedad de un proyecto ───────────────
// El usuario pega el CA del token, conecta su wallet y el backend verifica
// on-chain (Solana: mint authority o creador del mint). Si no se puede
// comprobar automáticamente queda "en revisión" para el admin.
const CLAIM_STATUS_META: Record<string, { label: string; cls: string }> = {
  verified: { label: 'VERIFICADO', cls: 'border-[#8FA83F]/40 bg-[#8FA83F]/12 text-primary' },
  pending: { label: 'EN REVISIÓN', cls: 'border-white/15 bg-white/5 text-muted-foreground' },
  rejected: { label: 'RECHAZADO', cls: 'border-[#ff8080]/30 bg-[#ff8080]/10 text-[#ff8080]' },
}

function ClaimProjectSection() {
  const claim = useClaimProject()
  const { data: claimsData, isLoading } = useProjectClaims()
  const [network, setNetwork] = useState('solana')
  const [contract, setContract] = useState('')
  const [wallet, setWallet] = useState('')
  const [walletKind, setWalletKind] = useState<'phantom' | 'evm' | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setWalletKind(injectedWalletFor(network)), 0)
    return () => clearTimeout(t)
  }, [network])

  const connectInjected = async () => {
    try {
      if (walletKind === 'phantom') {
        const provider = window.phantom?.solana ?? window.solana
        if (!provider?.connect) throw new Error('No se detectó Phantom')
        const res = await provider.connect()
        setWallet(res.publicKey.toString())
      } else if (walletKind === 'evm') {
        const accounts = (await window.ethereum?.request({ method: 'eth_requestAccounts' })) as
          | string[]
          | undefined
        if (accounts?.[0]) setWallet(accounts[0])
      } else {
        toast.error('No hay wallet del navegador para esta red; pega la dirección a mano')
      }
    } catch (e) {
      toast.error((e as Error).message || 'Conexión rechazada')
    }
  }

  const submit = () => {
    if (!contract.trim()) {
      toast.error('Pega el contrato (CA) del token')
      return
    }
    if (!wallet.trim()) {
      toast.error('Conecta tu wallet o pega tu dirección')
      return
    }
    claim.mutate({ contract: contract.trim(), network, wallet: wallet.trim() })
  }

  const claims = claimsData?.claims ?? []

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        ¿Eres el dev de un proyecto publicado aquí? Pega su CA, conecta tu wallet y verificamos
        on-chain que es tuyo. Al confirmarlo, el proyecto queda vinculado a tu perfil.
      </p>

      {/* Formulario de reclamo */}
      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Red del proyecto">
          {Object.entries(NETWORKS).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setNetwork(key)}
              aria-pressed={network === key}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                network === key
                  ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                  : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
              )}
            >
              <NetworkIcon network={key} className="h-3 w-3" />
              {meta.label}
            </button>
          ))}
        </div>

        <div className="mt-2.5 space-y-1.5">
          <Label htmlFor="claim-ca" className="text-xs text-muted-foreground">Contrato del token (CA)</Label>
          <Input
            id="claim-ca"
            value={contract}
            onChange={(e) => setContract(e.target.value)}
            placeholder={network === 'solana' ? '6iz4scC…pump' : '0x…'}
            spellCheck={false}
            autoComplete="off"
            className="h-9 bg-[#121410] font-mono text-xs"
          />
        </div>

        <div className="mt-2.5 space-y-1.5">
          <Label htmlFor="claim-wallet" className="text-xs text-muted-foreground">Tu wallet (creador del token)</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="claim-wallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="Dirección de tu wallet…"
              spellCheck={false}
              autoComplete="off"
              className="h-9 min-w-0 flex-1 bg-[#121410] font-mono text-xs"
            />
            {walletKind && (
              <Button
                size="sm"
                variant="ghost"
                onClick={connectInjected}
                className="h-9 shrink-0 rounded-lg border border-[#8FA83F]/35 bg-[#8FA83F]/10 px-2.5 text-xs font-bold text-primary hover:bg-[#8FA83F]/20 hover:text-primary"
              >
                {walletKind === 'phantom' ? 'Phantom' : 'MetaMask'}
              </Button>
            )}
          </div>
        </div>

        <Button
          size="sm"
          onClick={submit}
          disabled={claim.isPending}
          className="mt-3 h-9 w-full gap-1.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {claim.isPending ? 'Verificando on-chain…' : 'Verificar y reclamar'}
        </Button>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
          Verificación automática en Solana (mint authority o creador del mint). Otras redes pasan
          a revisión del equipo Cabal.
        </p>
      </div>

      {/* Mis reclamos */}
      {isLoading ? (
        <p className="py-2 text-center text-xs text-muted-foreground">Cargando reclamos…</p>
      ) : claims.length > 0 ? (
        <div className="space-y-1.5">
          {claims.map((c) => {
            const meta = CLAIM_STATUS_META[c.status] ?? CLAIM_STATUS_META.pending
            return (
              <div key={c.id} className="rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-bold">
                    {c.projectName}
                    {c.projectTicker ? <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground">${c.projectTicker}</span> : null}
                  </p>
                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider', meta.cls)}>
                    {meta.label}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{c.contract}</p>
                {(c.note || c.verifiedAt) && (
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
                    {c.note}
                    {c.verifiedAt ? ` · ${timeAgo(c.verifiedAt)}` : ''}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

// Fila de conexión con proveedor externo (X / Google)
// - Con API keys: redirige al flujo OAuth 2.0 real del proveedor.
// - Sin API keys, en desarrollo: abre la pantalla de consentimiento simulada (demo).
// - Sin API keys, en producción: el proveedor no está disponible.
function ConnectionRow({
  icon,
  title,
  subtitle,
  verified,
  verifiedLabel,
  provider,
  cta,
  configured,
  demo,
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
  demo: boolean
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
          disabled={!configured && !demo}
          className="h-8 shrink-0 rounded-lg border border-[#8FA83F]/35 bg-[#8FA83F]/10 px-3 text-xs font-bold text-primary hover:bg-[#8FA83F]/20 hover:text-primary"
          variant="ghost"
        >
          {configured || demo ? cta : 'No disponible'}
        </Button>
      </div>
      {!configured && (
        <p className="mt-2 pl-12 text-[10px] leading-relaxed text-muted-foreground/70">
          {demo
            ? 'Sin credenciales del proveedor: se abre una pantalla de autorización simulada. Configura las API keys para usar el OAuth real.'
            : 'Este proveedor todavía no está configurado en el servidor.'}
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

// ================= WALLET + TRACK RECORD DE DEV =================

const fmtCompact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 2 })
const fmtUsd = (n: number | null | undefined) =>
  n == null ? '—' : `$${fmtCompact.format(n)}`
const fmtPct = (n: number | null | undefined) => (n == null ? '—' : `${n}%`)
const ageOf = (ms: number | null | undefined) =>
  ms == null ? '—' : timeAgo(new Date(ms).toISOString())

/**
 * Gestor de wallets conectadas + verificación de tokens antiguos como dev.
 * - Conectar: wallet inyectada (Phantom/MetaMask) o dirección pegada a mano.
 * - Verificar posesión: firma criptográfica (ed25519 / personal_sign).
 * - Track record: reclama un CA y el backend trae métricas reales on-chain
 *   (MC, ATH, liquidez, volumen, concentración) vía DexScreener/GeckoTerminal.
 */
function WalletManager({ me }: { me: MeDTO }) {
  const [network, setNetwork] = useState('solana')
  const [address, setAddress] = useState('')
  const [walletKind, setWalletKind] = useState<'phantom' | 'evm' | null>(null)

  useEffect(() => {
    // async: las wallets inyectadas solo existen en el cliente
    const t = setTimeout(() => setWalletKind(injectedWalletFor(network)), 0)
    return () => clearTimeout(t)
  }, [network])

  const addWallet = useAddWallet()
  const verifySig = useVerifyWalletSignature()
  const removeWallet = useRemoveWallet()
  const verifyToken = useVerifyDevToken()
  const removeClaim = useRemoveDevToken()

  const connectInjected = async () => {
    try {
      if (walletKind === 'phantom') {
        const provider = window.phantom?.solana ?? window.solana
        if (!provider?.connect) throw new Error('No se detectó Phantom')
        const res = await provider.connect()
        setAddress(res.publicKey.toString())
      } else if (walletKind === 'evm') {
        const accounts = (await window.ethereum?.request({ method: 'eth_requestAccounts' })) as
          | string[]
          | undefined
        if (accounts?.[0]) setAddress(accounts[0])
      } else {
        toast.error('No hay wallet del navegador para esta red; pega la dirección a mano')
      }
    } catch (e) {
      toast.error((e as Error).message || 'Conexión rechazada')
    }
  }

  const add = () => {
    const a = address.trim()
    if (!a) {
      toast.error('Pega la dirección de tu wallet')
      return
    }
    addWallet.mutate(
      {
        network,
        address: a,
        label: walletKind === 'phantom' ? 'Phantom' : walletKind === 'evm' ? 'MetaMask' : 'Manual',
      },
      { onSuccess: () => setAddress('') }
    )
  }

  const unsigned = me.wallets.filter((w) => !w.signature)

  return (
    <div className="space-y-3">
      {/* Wallets conectadas */}
      {me.wallets.length > 0 && (
        <div className="space-y-1.5">
          {me.wallets.map((w) => (
            <WalletRow
              key={w.id}
              wallet={w}
              onRemove={() => removeWallet.mutate(w.id)}
              onVerify={() => verifySig.mutate({ id: w.id, network: w.network, address: w.address })}
              verifying={verifySig.isPending}
              busy={removeWallet.isPending}
            />
          ))}
        </div>
      )}

      {/* Conectar nueva wallet */}
      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
        <p className="flex items-center gap-1.5 text-[13px] font-bold">
          <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden /> Conectar wallet
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Red de la wallet">
          {Object.entries(NETWORKS).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setNetwork(key)}
              aria-pressed={network === key}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                network === key
                  ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                  : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
              )}
            >
              <NetworkIcon network={key} className="h-3 w-3" />
              {meta.label}
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={`Dirección ${NETWORKS[network as keyof typeof NETWORKS]?.label ?? network}…`}
            inputMode="text"
            spellCheck={false}
            autoComplete="off"
            aria-label={`Dirección de wallet en ${network}`}
            className="h-9 min-w-0 flex-1 bg-[#121410] font-mono text-xs"
          />
          {walletKind && (
            <Button
              size="sm"
              variant="ghost"
              onClick={connectInjected}
              className="h-9 shrink-0 rounded-lg border border-[#8FA83F]/35 bg-[#8FA83F]/10 px-2.5 text-xs font-bold text-primary hover:bg-[#8FA83F]/20 hover:text-primary"
            >
              {walletKind === 'phantom' ? 'Phantom' : 'MetaMask'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={add}
            disabled={addWallet.isPending}
            className="h-9 shrink-0 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
          >
            {addWallet.isPending ? '…' : 'Conectar'}
          </Button>
        </div>
        {unsigned.length > 0 && (
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Firma la wallet para probar que eres el dueño (+10 pts, una vez). Si no tienes la
            extensión a mano, la dirección queda guardada igualmente.
          </p>
        )}
      </div>

      {/* Verificar tokens antiguos como dev */}
      <DevClaimForm
        me={me}
        onVerify={(data) => verifyToken.mutate(data)}
        verifying={verifyToken.isPending}
      />

      {/* Track record */}
      {me.devClaims.length > 0 ? (
        <div className="space-y-2">
          {me.devClaims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              onRetry={() =>
                verifyToken.mutate({
                  network: claim.network,
                  contract: claim.contract,
                  walletAddress: claim.walletAddress,
                })
              }
              onDelete={() => removeClaim.mutate(claim.id)}
              busy={verifyToken.isPending || removeClaim.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
          Lanzaste tokens antes de Cabal? Pega el CA y verifica on-chain que fuiste el dev:
          tu perfil mostrará el ATH, la liquidez y la concentración real de esos tokens.
        </p>
      )}
    </div>
  )
}

function WalletRow({
  wallet,
  onRemove,
  onVerify,
  verifying,
  busy,
}: {
  wallet: WalletLinkDTO
  onRemove: () => void
  onVerify: () => void
  verifying?: boolean
  busy?: boolean
}) {
  const copy = () => {
    navigator.clipboard?.writeText(wallet.address).then(
      () => toast.success('Dirección copiada'),
      () => toast.error('No se pudo copiar')
    )
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0a0b08] p-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5" aria-hidden>
        <NetworkIcon network={wallet.network} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[12px] font-bold">
          <span className="truncate">{shortWallet(wallet.address)}</span>
          {wallet.signature ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#8FA83F]/15 px-1 py-px text-[9px] font-black uppercase text-primary">
              <BadgeCheck className="h-2.5 w-2.5" aria-hidden /> Firmada
            </span>
          ) : (
            <span className="shrink-0 rounded bg-white/8 px-1 py-px text-[9px] font-black uppercase text-zinc-400">
              Sin firmar
            </span>
          )}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {NETWORKS[wallet.network as keyof typeof NETWORKS]?.label ?? wallet.network}
          {wallet.label ? ` · ${wallet.label}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={copy}
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Copiar dirección"
        >
          <Copy className="h-3 w-3" />
        </Button>
        {!wallet.signature && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onVerify}
            disabled={verifying}
            className="h-7 rounded-lg border border-[#8FA83F]/35 bg-[#8FA83F]/10 px-2 text-[10px] font-bold text-primary hover:bg-[#8FA83F]/20 hover:text-primary"
          >
            {verifying ? 'Firmando…' : 'Firmar'}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          disabled={busy}
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-[#ff8080]"
          aria-label="Desconectar wallet"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

/** Formulario para reclamar un token antiguo (CA) como dev. */
function DevClaimForm({
  me,
  onVerify,
  verifying,
}: {
  me: MeDTO
  onVerify: (data: { network: string; contract: string; walletAddress: string }) => void
  verifying?: boolean
}) {
  const [network, setNetwork] = useState('solana')
  const [contract, setContract] = useState('')
  const [walletAddress, setWalletAddress] = useState(me.wallet ?? me.wallets[0]?.address ?? '')

  const submit = () => {
    const ca = contract.trim()
    const w = walletAddress.trim()
    if (!ca) {
      toast.error('Pega el CA del token')
      return
    }
    if (!w) {
      toast.error('Conecta o pega la wallet con la que lanzaste el token')
      return
    }
    onVerify({ network, contract: ca, walletAddress: w })
    setContract('')
  }

  return (
    <div className="rounded-xl border border-[#8FA83F]/20 bg-gradient-to-br from-[#8FA83F]/8 to-transparent p-3">
      <p className="flex items-center gap-1.5 text-[13px] font-bold">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Verificar token como dev
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Red del token">
        {Object.entries(NETWORKS).map(([key, meta]) => (
          <button
            key={key}
            type="button"
            onClick={() => setNetwork(key)}
            aria-pressed={network === key}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
              network === key
                ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
            )}
          >
            <NetworkIcon network={key} className="h-3 w-3" />
            {meta.label}
          </button>
        ))}
      </div>
      <div className="mt-2.5 space-y-2">
        <Input
          value={contract}
          onChange={(e) => setContract(e.target.value)}
          placeholder="CA / dirección del contrato del token"
          inputMode="text"
          spellCheck={false}
          autoComplete="off"
          aria-label="CA del token"
          className="h-9 bg-[#0a0b08] font-mono text-xs"
        />
        <Input
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="Tu wallet de despliegue (la que firmó el deploy)"
          inputMode="text"
          spellCheck={false}
          autoComplete="off"
          aria-label="Wallet de despliegue"
          className="h-9 bg-[#0a0b08] font-mono text-xs"
        />
        <Button
          onClick={submit}
          disabled={verifying}
          className="h-9 w-full gap-1.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
        >
          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          {verifying ? 'Consultando on-chain…' : 'Verificar on-chain'}
        </Button>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Consultamos DexScreener y GeckoTerminal: si el token tiene par activo, tu perfil
          mostrará el market cap, el ATH, la liquidez y la concentración top-10 reales.
        </p>
      </div>
    </div>
  )
}

/** Tarjeta de un token verificado (o pendiente) del track record del dev. */
function ClaimCard({
  claim,
  onRetry,
  onDelete,
  busy,
}: {
  claim: DevClaimDTO
  onRetry: () => void
  onDelete: () => void
  busy?: boolean
}) {
  const s = claim.stats
  const verified = claim.status === 'verified' && s?.found
  return (
    <div
      className={cn(
        'min-w-0 space-y-2 rounded-xl border p-3',
        verified ? 'border-[#8FA83F]/25 bg-[#8FA83F]/5' : 'border-amber-300/25 bg-amber-300/5'
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5" aria-hidden>
          <NetworkIcon network={claim.network} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-bold">
            <span className="min-w-0 truncate">{claim.name || claim.contract}</span>
            {claim.symbol && (
              <span className="shrink-0 font-mono text-[11px] text-primary">${claim.symbol}</span>
            )}
          </p>
          <p className="truncate font-mono text-[10px] text-muted-foreground" title={claim.contract}>
            {claim.contract}
          </p>
        </div>
        {verified ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#8FA83F]/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary">
            <BadgeCheck className="h-3 w-3" aria-hidden /> Verificado
          </span>
        ) : (
          <span className="shrink-0 rounded-md bg-amber-300/12 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-300">
            Pendiente
          </span>
        )}
      </div>

      {verified && s && (
        <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
          <Metric icon={<Activity className="h-3 w-3" />} label="MC actual" value={fmtUsd(s.marketCap ?? s.fdv)} />
          <Metric
            icon={<TrendingUp className="h-3 w-3" />}
            label="ATH (FDV est.)"
            value={fmtUsd(s.athFdv ?? s.athPrice)}
            highlight
          />
          <Metric icon={<Droplets className="h-3 w-3" />} label="Liquidez" value={fmtUsd(s.liquidityUsd)} />
          <Metric icon={<Activity className="h-3 w-3" />} label="Vol 24h" value={fmtUsd(s.volume24h)} />
          <Metric
            icon={<TrendingUp className="h-3 w-3" />}
            label="Δ 24h"
            value={s.change24h == null ? '—' : `${s.change24h > 0 ? '+' : ''}${s.change24h.toFixed(1)}%`}
            tone={s.change24h == null ? undefined : s.change24h >= 0 ? 'up' : 'down'}
          />
          <Metric icon={<Users className="h-3 w-3" />} label="Top-10 supply" value={fmtPct(s.top10Pct)} />
          <Metric icon={<CalendarDays className="h-3 w-3" />} label="Edad del par" value={ageOf(s.pairCreatedAt)} />
          <Metric icon={<TrendingUp className="h-3 w-3" />} label="ATH fecha" value={ageOf(s.athAt)} />
        </div>
      )}
      {!verified && claim.note && (
        <p className="text-[11px] leading-relaxed text-amber-300/80">{claim.note}</p>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
          wallet: {shortWallet(claim.walletAddress)}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {s?.pairUrl && (
            <a
              href={s.pairUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 items-center gap-1 rounded-lg border border-white/10 px-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" aria-hidden /> DexScreener
            </a>
          )}
          {!verified && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRetry}
              disabled={busy}
              className="h-7 gap-1 rounded-lg border border-white/10 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn('h-3 w-3', busy && 'animate-spin')} aria-hidden /> Reintentar
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            disabled={busy}
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-[#ff8080]"
            aria-label="Eliminar token del track record"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </span>
      </div>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  highlight,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  tone?: 'up' | 'down'
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-white/8 bg-[#0a0b08]/70 px-2 py-1.5">
      <p className="flex min-w-0 items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </p>
      <p
        className={cn(
          'truncate text-[13px] font-bold tabular-nums',
          highlight && 'text-primary',
          tone === 'up' && 'text-primary',
          tone === 'down' && 'text-[#ff8080]'
        )}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * Editor de foto de perfil: subir archivo (→ /api/upload) o pegar URL.
 * Aplica de inmediato (PATCH /api/me) para verla en el header al instante.
 */
function AvatarEditor({
  avatar,
  name,
  onApply,
  busy,
}: {
  avatar: string
  name: string
  onApply: (url: string) => void
  busy?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const isUrl = /^https:\/\/\S+$/i.test(avatar) || avatar.startsWith('/uploads/') || avatar.startsWith('/seed/')

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setUploading(true)
      const url = await uploadImage(file)
      onApply(url)
      toast.success('Foto de perfil actualizada')
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const applyUrl = () => {
    const u = urlDraft.trim()
    if (!/^https:\/\/\S+$/i.test(u)) {
      toast.error('Pega una URL https:// válida')
      return
    }
    onApply(u)
    setUrlDraft('')
    toast.success('Foto de perfil actualizada')
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <div className="flex items-center gap-3">
        <UserAvatar name={name} src={isUrl ? avatar : null} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">Foto de perfil</p>
          <p className="text-[11px] text-muted-foreground">JPG o PNG, máx. 2.5 MB</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
          aria-label="Subir foto de perfil"
        />
        <Button
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || busy}
          className="h-8 shrink-0 gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
        >
          <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          {uploading ? 'Subiendo…' : 'Subir foto'}
        </Button>
        {isUrl && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onApply('🐺')}
            disabled={busy}
            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-[#ff8080]"
            aria-label="Quitar foto"
            title="Quitar foto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <Input
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyUrl())}
          placeholder="…o pega la URL de la imagen (https://…)"
          inputMode="url"
          spellCheck={false}
          aria-label="URL de la foto de perfil"
          className="h-8 bg-[#121410] font-mono text-[12px]"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={applyUrl}
          disabled={busy || !urlDraft.trim()}
          className="h-8 shrink-0 rounded-lg border border-white/10 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Usar
        </Button>
      </div>
    </div>
  )
}
