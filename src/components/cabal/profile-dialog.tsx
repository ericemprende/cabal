'use client'

import { useState } from 'react'
import { BadgeCheck, Flame, Gift, MessageSquare, Rocket, Wallet, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { EmojiAvatar, PointsPill } from '@/components/cabal/shared'
import { timeAgo } from '@/lib/cabal'
import { useMe, useUpdateMe } from '@/lib/api-client'
import { useUI } from '@/lib/store'

const AVATARS = ['🐺', '🦈', '🦍', '🧙', '👩‍🚀', '🎓', '🍸', '🌲', '👻', '🏎️', '🐱', '🐸', '🚀', '💎', '🔥', '🎩']

const REASON_META: Record<string, { label: string; emoji: string }> = {
  thesis: { label: 'Tesis publicada', emoji: '🎓' },
  comment: { label: 'Comentario', emoji: '💬' },
  launch: { label: 'Launch publicado', emoji: '🚀' },
  like_received: { label: 'Likes recibidos', emoji: '❤️' },
  hype_received: { label: 'Hype recibido', emoji: '🔥' },
  daily_visit: { label: 'Visita diaria', emoji: '📅' },
  admin_adjust: { label: 'Bonus del Cabal', emoji: '🎁' },
  redeem: { label: 'Canje', emoji: '🔄' },
}

export function ProfileDialog() {
  const { profileOpen, setProfileOpen } = useUI()
  const { data: me } = useMe()

  return (
    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-[#00ff88]/20 bg-[#0b120d] p-0 sm:max-w-lg" aria-describedby={undefined}>
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
  const [avatar, setAvatar] = useState(me.avatar)
  const [wallet, setWallet] = useState(me.wallet ?? '')

  const save = () => {
    updateMe.mutate({
      name,
      bio,
      avatar,
      wallet: wallet.trim() && wallet.trim().length >= 20 ? wallet.trim() : (me.wallet ?? ''),
    })
    setProfileOpen(false)
  }

  return (
    <>
        <div className="relative border-b border-[#00ff88]/12 p-5">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#00ff88]/8 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <EmojiAvatar emoji={me?.avatar ?? '🐺'} size="xl" verified={me?.walletVerified} />
            <div className="min-w-0">
              <DialogTitle className="font-display truncate text-xl font-bold">{me?.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">@{me?.handle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PointsPill points={me?.points ?? 0} />
                <span className="rounded-full border border-[#00ff88]/20 px-2 py-0.5 text-[11px] text-muted-foreground">
                  Rank #{me?.pointsRank} por puntos
                </span>
                {me?.isAdmin && (
                  <span className="rounded-full bg-[#00ff88]/12 px-2 py-0.5 text-[11px] font-bold text-primary">ADMIN</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 border-b border-[#00ff88]/12 p-4">
          <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label="Posts" value={me?.stats.postsCount ?? 0} />
          <Stat icon={<Rocket className="h-3.5 w-3.5" />} label="Launches" value={me?.stats.launchesCount ?? 0} />
          <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Hypes" value={me?.stats.hypesGiven ?? 0} />
          <Stat icon={<Zap className="h-3.5 w-3.5" />} label="Lifetime ⚡" value={me?.lifetimePoints ?? 0} />
        </div>

        {/* Points wallet */}
        <div className="border-b border-[#00ff88]/12 p-4">
          <div className="rounded-xl border border-[#00ff88]/20 bg-gradient-to-br from-[#00ff88]/10 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Balance de puntos Cabal</p>
                <p className="font-display mt-1 text-3xl font-black text-primary text-glow">
                  {(me?.points ?? 0).toLocaleString('es')} <span className="text-base">⚡</span>
                </p>
              </div>
              <Gift className="h-10 w-10 text-primary/40" aria-hidden />
            </div>
            <p className="mt-2.5 rounded-lg bg-[#060a08]/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              🔄 Cuando lancemos <span className="font-bold text-primary">$CABAL</span>, tus puntos se canjean por tokens en el airdrop para la comunidad. 1 punto = 1🎟️ del pool comunitario.
            </p>
          </div>

          {/* history */}
          <p className="pb-1.5 pt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Historial de puntos</p>
          <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {(me?.pointEvents ?? []).length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Publica tesis o launches para ganar puntos ⚡</p>
            )}
            {(me?.pointEvents ?? []).map((e) => {
              const meta = REASON_META[e.reason] ?? { label: e.reason, emoji: '⚡' }
              return (
                <div key={e.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#00ff88]/4">
                  <span className="text-sm" aria-hidden>{meta.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{e.note ?? meta.label}</p>
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

        {/* Edit profile */}
        <div className="space-y-3.5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Editar perfil</p>
          <div>
            <Label className="text-xs text-muted-foreground">Avatar</Label>
            <div className="no-scrollbar mt-1.5 flex gap-1 overflow-x-auto rounded-lg border border-[#00ff88]/15 bg-[#060a08] p-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg transition-all',
                    avatar === a ? 'bg-[#00ff88]/15 ring-1 ring-[#00ff88]/50' : 'hover:bg-[#00ff88]/8'
                  )}
                  aria-label={`Avatar ${a}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-name" className="text-xs text-muted-foreground">Nombre</Label>
              <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 border-[#00ff88]/15 bg-[#060a08]" />
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
                className="h-9 border-[#00ff88]/15 bg-[#060a08] font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-bio" className="text-xs text-muted-foreground">Bio</Label>
            <Textarea id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[56px] resize-none border-[#00ff88]/15 bg-[#060a08]" />
          </div>
          <Button
            onClick={save}
            disabled={updateMe.isPending}
            className="h-10 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-[#00ff88]"
          >
            {updateMe.isPending ? 'Guardando…' : 'Guardar perfil'}
          </Button>
        </div>
    </>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#00ff88]/10 bg-[#060a08] px-2.5 py-2 text-center">
      <div className="mx-auto flex w-fit items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
    </div>
  )
}
