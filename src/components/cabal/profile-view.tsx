'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck, CalendarDays, Code2, Rocket, Send, Target, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fmtMc, timeAgo } from '@/lib/cabal'
import { CabalWordmark, NetworkBadge, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { XLogo } from '@/components/cabal/x-logo'
import { AuthDialog } from '@/components/cabal/auth-dialog'
import { LaunchDetailDialog } from '@/components/cabal/launch-detail'
import { TokenDetailDialog } from '@/components/cabal/token-detail'
import { ProfileDialog } from '@/components/cabal/profile-dialog'
import { useFollowToggle, useSession, useUserFollows, useUserProfile } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import type { PublicProfileDTO } from '@/lib/types'

/**
 * Perfil público de un usuario: quién es, a quién sigue y quién le sigue, sus
 * redes y verificaciones, los proyectos que ha publicado o que son suyos como
 * dev, y sus tesis y posts.
 *
 * Tiene su propia barra superior (como /publicar) en vez de la cabecera de la
 * app, que navega entre pestañas de /app y aquí no aplica.
 */
export function ProfileView({ handle }: { handle: string }) {
  const { data, isPending, isError } = useUserProfile(handle)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0b08]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-3 sm:px-4">
          <Link
            href="/app"
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Volver
          </Link>
          <Link href="/app" className="ml-1 flex items-center outline-none" aria-label="Ir al inicio">
            <CabalWordmark />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6">
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
      </main>

      {/* Diálogos que se abren desde el perfil (fichas, edición, login) */}
      <LaunchDetailDialog />
      <TokenDetailDialog />
      <ProfileDialog />
      <AuthDialog />
    </div>
  )
}

function ProfileContent({ profile }: { profile: PublicProfileDTO }) {
  const { user, counts } = profile
  const [list, setList] = useState<'followers' | 'following' | null>(null)
  const winRate = user.callsTotal > 0 ? Math.round((user.callsWon / user.callsTotal) * 100) : null

  return (
    <div className="space-y-5">
      <ProfileHeader profile={profile} onOpenList={setList} />

      {/* Estadísticas */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat icon={Trophy} label="Cabal Score" value={user.cabalScore.toLocaleString('es')} />
        <Stat
          icon={Target}
          label="Aciertos"
          value={winRate === null ? '—' : `${winRate}%`}
          hint={user.callsTotal > 0 ? `${user.callsWon} de ${user.callsTotal} calls` : 'Sin calls todavía'}
        />
        <Stat icon={Rocket} label="Launches" value={String(counts.launches)} />
        <Stat
          icon={Code2}
          label="Tokens como dev"
          value={String(counts.tokens + profile.devClaims.length)}
          hint="Verificados on-chain"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
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
  const { user, counts, isMe } = profile
  const { setProfileOpen, openAuth } = useUI()
  const { data: session } = useSession()
  const follow = useFollowToggle()
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
          verified={user.walletVerified}
          className="h-20 w-20 text-2xl sm:h-24 sm:w-24"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0">
              <h1 className="font-display flex items-center gap-1.5 text-2xl font-bold">
                <span className="truncate">{user.name}</span>
                {user.isDev && (
                  <span className="rounded-md bg-[#8FA83F]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    Dev
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">@{user.handle}</p>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              <CountButton label="Siguiendo" value={counts.following} onClick={() => onOpenList('following')} />
              <CountButton label="Seguidores" value={counts.followers} onClick={() => onOpenList('followers')} />
              {isMe ? (
                <Button
                  onClick={() => setProfileOpen(true)}
                  variant="outline"
                  className="h-10 rounded-xl border-white/15 bg-transparent px-4 font-bold hover:bg-white/5"
                >
                  Editar perfil
                </Button>
              ) : (
                <Button
                  onClick={toggleFollow}
                  disabled={follow.isPending}
                  className={cn(
                    'h-10 rounded-xl px-5 font-bold',
                    user.isFollowed
                      ? 'border border-white/15 bg-transparent text-foreground hover:bg-white/5'
                      : 'bg-primary text-primary-foreground hover:bg-[#9dba46]'
                  )}
                >
                  {user.isFollowed ? 'Siguiendo' : 'Seguir'}
                </Button>
              )}
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
                {user.xVerified && <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label="Verificado con X" />}
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
            <Verification ok={user.walletVerified} label="Wallet verificada" />
            <Verification ok={user.googleVerified} label="Google verificado" />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Se unió en {joined}
            </span>
          </div>
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
  const { openLaunch, openToken } = useUI()
  const { tokens, devClaims, launches } = profile
  const empty = tokens.length === 0 && devClaims.length === 0 && launches.length === 0

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Proyectos</h2>

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
  const meta =
    status === 'upcoming'
      ? { label: 'Próximo', cls: 'bg-[#8FA83F]/15 text-primary' }
      : status === 'live'
        ? { label: 'En vivo', cls: 'bg-[#ff4d5e]/15 text-[#ff8080]' }
        : { label: 'Finalizado', cls: 'bg-white/5 text-muted-foreground' }
  return <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold', meta.cls)}>{meta.label}</span>
}

// ---------------- Actividad: tesis y posts ----------------

function Activity({ profile }: { profile: PublicProfileDTO }) {
  const [tab, setTab] = useState<'theses' | 'posts'>('theses')
  const theses = profile.posts.filter((p) => p.kind === 'thesis')
  const shown = tab === 'theses' ? theses : profile.posts

  return (
    <section className="space-y-3">
      <div role="tablist" aria-label="Actividad" className="flex items-center gap-1.5">
        {(
          [
            ['theses', `Tesis · ${profile.counts.theses}`],
            ['posts', `Todo · ${profile.counts.posts}`],
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
          {tab === 'theses' ? 'Todavía no ha publicado ninguna tesis.' : 'Todavía no ha publicado nada.'}
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
  const { data, isPending } = useUserFollows(handle, type ?? 'followers', type !== null)
  const users = data?.users ?? []

  return (
    <Dialog open={type !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-hidden border-white/10 bg-[#121410] p-0 sm:max-w-md">
        <DialogTitle className="border-b border-white/10 px-5 py-4 text-base font-bold">
          {type === 'following' ? `@${handle} sigue a` : `Seguidores de @${handle}`}
        </DialogTitle>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isPending ? (
            <div className="space-y-2 p-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {type === 'following' ? 'Todavía no sigue a nadie.' : 'Todavía no tiene seguidores.'}
            </p>
          ) : (
            users.map((u) => (
              <Link
                key={u.id}
                href={`/u/${u.handle}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5"
              >
                <UserAvatar name={u.name} handle={u.handle} src={u.avatar} size="sm" verified={u.walletVerified} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{u.handle}</p>
                </div>
                {u.isFollowed && <span className="text-[11px] text-muted-foreground">Siguiendo</span>}
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
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}

