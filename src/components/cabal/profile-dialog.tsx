'use client'

import { useState } from 'react'
import {
  AtSign,
  BadgeCheck,
  CalendarDays,
  Flame,
  Gift,
  GraduationCap,
  Heart,
  Mail,
  MessageSquare,
  RefreshCw,
  Rocket,
  Wallet,
  Zap,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { PointsPill, UserAvatar } from '@/components/cabal/shared'
import { timeAgo } from '@/lib/cabal'
import { useMe, useUpdateMe, useVerifyProvider } from '@/lib/api-client'
import { useUI } from '@/lib/store'

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
  const [name, setName] = useState(me.name)
  const [bio, setBio] = useState(me.bio ?? '')
  const [wallet, setWallet] = useState(me.wallet ?? '')

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

        {/* Conexiones: X y Google */}
        <div className="space-y-2 border-b border-white/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conexiones y verificación</p>
          <ConnectionRow
            icon={<AtSign className="h-4 w-4" />}
            title="Cuenta de X"
            subtitle="Verifica tu identidad con tu cuenta de X · +5 puntos"
            verified={me?.xVerified ?? false}
            verifiedLabel={me?.xHandle ? `@${me.xHandle}` : 'Verificada'}
            placeholder="@tu_usuario"
            provider="x"
            cta="Verificar con X"
          />
          <ConnectionRow
            icon={<Mail className="h-4 w-4" />}
            title="Cuenta de Google"
            subtitle="Confirma tu email con Google · +5 puntos"
            verified={me?.googleVerified ?? false}
            verifiedLabel={me?.googleEmail ?? 'Verificada'}
            placeholder="tu@email.com"
            provider="google"
            cta="Verificar con Google"
          />
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

// Fila de conexión con proveedor externo (X / Google) con verificación inline
function ConnectionRow({
  icon,
  title,
  subtitle,
  verified,
  verifiedLabel,
  placeholder,
  provider,
  cta,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  verified: boolean
  verifiedLabel: string
  placeholder: string
  provider: 'x' | 'google'
  cta: string
}) {
  const verify = useVerifyProvider()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

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
          <p className="text-[13px] font-bold">{title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'h-8 shrink-0 rounded-lg border border-[#8FA83F]/35 bg-[#8FA83F]/10 px-3 text-xs font-bold text-primary hover:bg-[#8FA83F]/20 hover:text-primary'
          )}
          variant="ghost"
        >
          {open ? 'Cancelar' : cta}
        </Button>
      </div>
      {open && (
        <div className="mt-2.5 flex items-center gap-2">
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="h-9 bg-[#121410] text-sm"
            aria-label={title}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) verify.mutate({ provider, value: value.trim() })
            }}
          />
          <Button
            size="sm"
            disabled={!value.trim() || verify.isPending}
            onClick={() => verify.mutate({ provider, value: value.trim() })}
            className="h-9 shrink-0 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
          >
            {verify.isPending ? 'Conectando…' : 'Conectar'}
          </Button>
        </div>
      )}
    </div>
  )
}
