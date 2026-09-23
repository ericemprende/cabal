'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, CalendarDays, Code2, Crown, Rocket, Send, Target, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { fmtMc, timeAgo } from '@/lib/cabal'
import { BadgesRow, NetworkBadge, PremiumPill, TokenGlyph, UserAvatar, OfficialBadge } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { CallStats } from '@/components/cabal/call-stats'
import { ReputationActions, TrustBadge } from '@/components/cabal/reputation'
import { XLogo } from '@/components/cabal/x-logo'
import { Header } from '@/components/cabal/header'
import { LeftFeed, RightRail } from '@/components/cabal/sidebars'
import { Ticker } from '@/components/cabal/ticker'
import { MobileNav } from '@/components/cabal/mobile-nav'
import { LaunchDetailDialog } from '@/components/cabal/launch-detail'
import { TokenDetailDialog } from '@/components/cabal/token-detail'
import { ProfileDialog } from '@/components/cabal/profile-dialog'
import { PremiumDialog } from '@/components/cabal/premium-dialog'
import { AmmoDialog } from '@/components/cabal/ammo-dialog'
import { DonateDialog } from '@/components/cabal/donate-dialog'
import { GuideAssistant } from '@/components/cabal/guide-assistant'
import { useFollowToggle, useSession, useUserFollows, useUserProfile } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { usePresenceConnection, useIsOnline } from '@/lib/presence'
import type { PublicProfileDTO } from '@/lib/types'

/**
 * Perfil público de un usuario: quién es, a quién sigue y quién le sigue, sus
 * redes y verificaciones, los proyectos que ha publicado o que son suyos como
 * dev, y sus tesis y posts.
 *
 * Vive dentro de la misma estructura que /app (cabecera, actividad a la
 * izquierda, próximos launches y top a la derecha) para que al entrar en un
 * perfil no se pierda el resto del Cabal.
 */
export function ProfileView({ handle }: { handle: string }) {
  const { data, isPending, isError } = useUserProfile(handle)
  // Perfil público es un punto de entrada aparte de /app: necesita su propio
  // socket de presencia para el puntico verde del header y del chat.
  usePresenceConnection()

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 pb-24 pt-4 sm:px-4 md:pb-12">
        <div className="flex gap-5">
          <LeftFeed />

          <div className="min-w-0 flex-1">
            {isPending ? (
              <ProfileSkeleton />
            ) : isError || !data ? (
              <div className="py-24 text-center">
                <p className="font-semibold">No encontramos a @{handle}</p>
                <Link href="/app" className="mt-3 inline-block text-sm text-primary hover:underline">
                  Volver al radar
                </Link>
              </div>
            ) : (
              <ProfileContent profile={data} />
            )}
          </div>

          <RightRail />
        </div>
      </main>

      <Ticker />
      <MobileNav />

      {/* Diálogos que se abren desde el perfil (fichas y edición). El de login
          ya lo monta la cabecera. */}
      <LaunchDetailDialog />
      <TokenDetailDialog />
      <ProfileDialog />
      <PremiumDialog />
      <AmmoDialog />
      <DonateDialog />
      <GuideAssistant />
    </div>
  )
}

function ProfileContent({ profile }: { profile: PublicProfileDTO }) {
  const t = useT()
  const { user, counts } = profile
  const [list, setList] = useState<'followers' | 'following' | null>(null)

  return (
    <div className="space-y-5">
      <ProfileHeader profile={profile} onOpenList={setList} />

      {/* Estadísticas de calls: públicas, con filtro de periodo */}
      <CallStats handle={user.handle} />

      <div className="grid grid-cols-2 gap-2.5">
        <Stat icon={Rocket} label={t.profileView.launches} value={String(counts.launches)} />
        <Stat
          icon={Code2}
          label={t.profileView.devTokens}
          value={String(counts.tokens + profile.devClaims.length)}
          hint={t.profileView.onChainVerified}
        />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1fr_1.15fr]">
        <Projects profile={profile} />
        <Activity profile={profile} />
      </div>

      <FollowListDialog handle={user.handle} type={list} onClose={() => setList(null)} />
    </div>
  )
}

// ---------------- Cabecera ----------------

function ProfileHeader({
  profile,
  onOpenList,
}: {
  profile: PublicProfileDTO
  onOpenList: (type: 'followers' | 'following') => void
}) {
  const t = useT()
  const { user, counts, isMe } = profile
  const { setProfileOpen, openAuth, setPremiumOpen } = useUI()
  const { data: session } = useSession()
  const follow = useFollowToggle()
  const online = useIsOnline(user.id)
  // Pop-up de reputación: desde la insignia, el botón Reseñas o un enlace /u/x#reputacion
  const [repOpen, setRepOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === '#reputacion')
  const joined = new Date(profile.joinedAt).toLocaleDateString('es', { month: 'long', year: 'numeric' })

  const toggleFollow = () => {
    // Sin sesión no se puede seguir a nadie: se pide entrar en vez de fallar
    if (!session?.loggedIn) return openAuth('login')
    follow.mutate(user.id)
  }

  return (
    <section className="card-surface rounded-2xl border border-white/10 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <UserAvatar
          name={user.name}
          handle={user.handle}
          src={user.avatar}
          size="xl"
          verified={user.walletVerified} official={user.verified}
          premium={profile.premium}
          online={online}
          className="h-20 w-20 text-2xl sm:h-24 sm:w-24"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0">
              <h1 className="font-display flex items-center gap-1.5 text-2xl font-bold">
                <span className="truncate">{user.name}</span>
                {user.verified && <OfficialBadge label />}
                {user.isDev && (
                  <span className="rounded-md bg-[#8FA83F]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    Dev
                  </span>
                )}
                {profile.premium && <PremiumPill />}
              </h1>
              {/* Confianza de la comunidad, arriba del todo: es lo primero que
                  se mira antes de entrar a un launch de esta persona. */}
              <button type="button" onClick={() => setRepOpen(true)} className="mt-1 inline-flex transition-opacity hover:opacity-80">
                <TrustBadge rep={user.reputation} />
              </button>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                @{user.handle}
                {online && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden /> En línea
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 sm:ml-auto sm:items-end">
            <div className="flex items-center gap-2">
              <CountButton label={t.profileView.following} value={counts.following} onClick={() => onOpenList('following')} />
              <CountButton label={t.profileView.followers} value={counts.followers} onClick={() => onOpenList('followers')} />
              {isMe ? (
                <>
                  {!profile.premium && (
                    <Button
                      onClick={() => setPremiumOpen(true)}
                      className="gap-1.5 bg-amber-400 px-4 font-bold text-[#171200] hover:bg-amber-300"
                    >
                      <Crown className="h-4 w-4 fill-[#171200]" aria-hidden /> Hazte Pro
                    </Button>
                  )}
                  <Button
                    onClick={() => setProfileOpen(true)}
                    variant="outline"
                    className="border-white/15 bg-transparent px-4 font-bold hover:bg-white/5"
                  >
                    Editar perfil
                  </Button>
                </>
              ) : (
                <Button
                  onClick={toggleFollow}
                  disabled={follow.isPending}
                  variant={user.isFollowed ? 'secondary' : 'default'}
                >
                  {user.isFollowed ? t.profileView.following : t.profileView.follow}
                </Button>
              )}
            </div>
            {/* Confío / No confío justo debajo de seguir; la reseña va en el pop-up */}
            <ReputationActions handle={user.handle} name={user.name} open={repOpen} onOpenChange={setRepOpen} />
            </div>
          </div>

          {user.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed">{user.bio}</p>}

          {/* Verificaciones y redes */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {user.xHandle && (
              <a
                href={`https://x.com/${user.xHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold hover:border-white/25"
              >
                <XLogo className="h-3 w-3" /> @{user.xHandle}
                {user.xVerified && <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label={t.profileView.xVerified} />}
              </a>
            )}
            {user.tgHandle && (
              <a
                href={`https://t.me/${user.tgHandle.replace(/^@+/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold hover:border-white/25"
              >
                <Send className="h-3 w-3" aria-hidden /> @{user.tgHandle.replace(/^@+/, '')}
              </a>
            )}
            <Verification ok={user.walletVerified} label={t.profileView.walletVerified} />
            <Verification ok={user.googleVerified} label={t.profileView.googleVerified} />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Se unió en {joined}
            </span>
          </div>

          {/* Emblemas: fundador, actividad… pasa el mouse para leer cada uno */}
          <BadgesRow badges={profile.badges} className="mt-3" />
        </div>
      </div>
    </section>
  )
}

function CountButton({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl px-3 py-1.5 text-center transition-colors hover:bg-white/5"
    >
      <p className="text-lg font-bold tabular-nums leading-tight">{value.toLocaleString('es')}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </button>
  )
}

/** Solo se enseña lo que está verificado: un "no verificado" no aporta nada. */
function Verification({ ok, label }: { ok: boolean; label: string }) {
  if (!ok) return null
  return (
    <span className="flex items-center gap-1 rounded-full bg-[#8FA83F]/10 px-2.5 py-1 text-xs font-semibold text-primary">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {label}
    </span>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Trophy
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121410] p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary/70" aria-hidden /> {label}
      </p>
      <p className="mt-1.5 text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ---------------- Proyectos ----------------

function Projects({ profile }: { profile: PublicProfileDTO }) {
  const t = useT()
  const { openLaunch, openToken } = useUI()
  const { tokens, devClaims, launches } = profile
  const empty = tokens.length === 0 && devClaims.length === 0 && launches.length === 0

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.profileView.projects}</h2>

      {empty && (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
          Todavía no ha publicado ni lanzado ningún proyecto.
        </p>
      )}

      {(tokens.length > 0 || devClaims.length > 0) && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#121410]">
          <p className="border-b border-white/10 px-3.5 py-2 text-[11px] font-semibold text-muted-foreground">
            Como dev · verificado on-chain
          </p>
          {tokens.map((t) => (
            <button
              key={t.id}
              onClick={() => openToken(t.id)}
              className="flex w-full items-center gap-3 border-b border-white/5 px-3.5 py-2.5 text-left last:border-0 hover:bg-white/[0.03]"
            >
              <TokenGlyph src={t.image} ticker={t.ticker} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">${t.ticker}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t.name} · {timeAgo(t.launchedAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums">{fmtMc(t.mc)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t.isRug ? <span className="font-bold text-[#ff8080]">RUG</span> : `ATH ${fmtMc(t.athMc)}`}
                </p>
              </div>
            </button>
          ))}
          {devClaims.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b border-white/5 px-3.5 py-2.5 last:border-0">
              <TokenGlyph ticker={c.symbol || c.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.symbol ? `$${c.symbol}` : c.name}</p>
                <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                  <NetworkBadge network={c.network} /> {c.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums">{fmtMc(c.stats?.marketCap ?? c.stats?.fdv ?? 0)}</p>
                {c.stats?.athFdv ? (
                  <p className="text-[11px] text-muted-foreground">ATH {fmtMc(c.stats.athFdv)}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {launches.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#121410]">
          <p className="border-b border-white/10 px-3.5 py-2 text-[11px] font-semibold text-muted-foreground">
            Launches publicados
          </p>
          {launches.map((l) => (
            <button
              key={l.id}
              onClick={() => openLaunch(l.id)}
              className="flex w-full items-center gap-3 border-b border-white/5 px-3.5 py-2.5 text-left last:border-0 hover:bg-white/[0.03]"
            >
              <TokenGlyph src={l.image} ticker={l.ticker ?? l.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{l.ticker ? `$${l.ticker}` : l.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {l.name} · {timeAgo(l.launchAt)}
                </p>
              </div>
              <LaunchState status={l.status} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function LaunchState({ status }: { status: string }) {
  const t = useT()
  const meta =
    status === 'upcoming'
      ? { label: t.profileView.upcoming, cls: 'bg-[#8FA83F]/15 text-primary' }
      : status === 'live'
        ? { label: t.profileView.live, cls: 'bg-[#ff4d5e]/15 text-[#ff8080]' }
        : { label: t.profileView.finished, cls: 'bg-white/5 text-muted-foreground' }
  return <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold', meta.cls)}>{meta.label}</span>
}

// ---------------- Actividad: tesis y posts ----------------

function Activity({ profile }: { profile: PublicProfileDTO }) {
  const t = useT()
  const [tab, setTab] = useState<'theses' | 'posts'>('theses')
  const theses = profile.posts.filter((p) => p.kind === 'thesis')
  const shown = tab === 'theses' ? theses : profile.posts

  return (
    <section className="space-y-3">
      <div role="tablist" aria-label={t.profileView.activity} className="flex items-center gap-1.5">
        {(
          [
            ['theses', t.profileView.tabTheses(profile.counts.theses)],
            ['posts', t.profileView.tabAll(profile.counts.posts)],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              tab === key
                ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                : 'border-white/10 text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
          {tab === 'theses' ? t.profileView.noTheses : t.profileView.nothingYet}
        </p>
      ) : (
        <div className="space-y-2.5">
          {shown.map((p) => (
            <PostCard key={p.id} post={p} compact />
          ))}
        </div>
      )}
    </section>
  )
}

// ---------------- Seguidores / seguidos ----------------

function FollowListDialog({
  handle,
  type,
  onClose,
}: {
  handle: string
  type: 'followers' | 'following' | null
  onClose: () => void
}) {
  const t = useT()
  const { data, isPending } = useUserFollows(handle, type ?? 'followers', type !== null)
  const users = data?.users ?? []

  return (
    <Dialog open={type !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[80dvh] overflow-hidden border-white/10 bg-[#121410] p-0 sm:max-w-md">
        <DialogTitle className="border-b border-white/10 px-5 py-4 text-base font-bold">
          {type === 'following' ? t.profileView.followsList(handle) : t.profileView.followersList(handle)}
        </DialogTitle>
        <div className="max-h-[60dvh] overflow-y-auto p-2">
          {isPending ? (
            <div className="space-y-2 p-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {type === 'following' ? t.profileView.followsNobody : t.profileView.noFollowers}
            </p>
          ) : (
            users.map((u) => (
              <Link
                key={u.id}
                href={`/u/${u.handle}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5"
              >
                <UserAvatar name={u.name} handle={u.handle} src={u.avatar} size="sm" verified={u.walletVerified} official={u.verified} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{u.handle}</p>
                </div>
                {u.isFollowed && <span className="text-[11px] text-muted-foreground">{t.profileView.following}</span>}
              </Link>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 2xl:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}

