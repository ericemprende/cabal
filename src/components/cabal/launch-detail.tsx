'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Crown, Flame, Globe, Lock, Maximize2, Minimize2, MonitorPlay, Pencil, Rocket, Wallet, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RichText } from '@/components/cabal/rich-text'
import { displayImageUrl } from '@/lib/remote-image'
import { TrustBadge } from '@/components/cabal/reputation'
import { CopyCA, CountdownPill, EstimatedDateBadge, NetworkBadge, PremiumLockedRow, SafetyChecks, TickerLabel, TokenGlyph, UserAvatar, OfficialBadge } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { ExternalLinksRow, LiveChart } from '@/components/cabal/live-chart'
import { TradePanel } from '@/components/cabal/trade-panel'
import { timeAgo } from '@/lib/cabal'
import { useCreatePost, useFollowToggle, useHypeToggle, useLaunch, useMe, usePointRules } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { ReminderBell } from '@/components/cabal/reminder-bell'
import { BoostButton } from '@/components/cabal/ammo'
import { VerifyRequestRow } from '@/components/cabal/verify-request'
import { FudButton } from '@/components/cabal/fud-button'
import { XLogo } from '@/components/cabal/x-logo'
import { TelegramLogo } from '@/components/cabal/telegram-logo'

export function LaunchDetailDialog() {
  const { launchDetailId, openLaunch, setPremiumOpen } = useUI()
  const { data: launch, isLoading } = useLaunch(launchDetailId)
  const hype = useHypeToggle()
  const { data: me } = useMe()
  const follow = useFollowToggle()
  const createPost = useCreatePost()
  const rules = usePointRules()
  const [comment, setComment] = useState('')
  const [expanded, setExpanded] = useState(false)

  return (
    <Dialog
      open={!!launchDetailId}
      onOpenChange={(v) => {
        if (!v) {
          openLaunch(null)
          setComment('')
          setExpanded(false)
        }
      }}
    >
      <DialogContent
        className={cn(
          'gap-0 overflow-x-hidden overflow-y-auto border-white/10 bg-[#121410] p-0',
          expanded ? 'max-h-[96dvh] sm:max-w-[96vw] lg:max-w-[1440px]' : 'max-h-[90dvh] sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl'
        )}
        aria-describedby={undefined}
      >
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Achicar' : 'Ampliar'}
          className="absolute right-12 top-4 z-10 hidden rounded-xs sm:block text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:text-foreground"
        >
          {expanded ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
        </button>
        {isLoading || !launch ? (
          <div className="space-y-3 p-6">
            <DialogTitle className="sr-only">Detalle del lanzamiento</DialogTitle>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <LaunchBanner src={launch.banner} name={launch.name} />
            <div className="relative border-b border-white/10 p-4 sm:p-5">
              <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#8FA83F]/8 blur-3xl" />
              <DialogTitle className="flex items-start gap-3 pr-8 text-left sm:pr-10">
                <TokenGlyph src={launch.image} ticker={launch.ticker ?? launch.name} size="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="font-display flex min-w-0 flex-wrap items-center gap-x-2 text-xl font-bold">
                      <span className="min-w-0 truncate">{launch.name}</span>
                      <TickerLabel ticker={launch.ticker} isPrivate={launch.isPrivate} className="text-primary" />
                    </h2>
                    {launch.verified && <OfficialBadge label title="Launch oficial verificado por Cabal" />}
                    <NetworkBadge network={launch.network} />
                  </div>
                  {launch.isPrivate && !launch.ticker && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-300/90">
                      Ticker reservado · se revela en el bloque 1
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <CountdownPill target={launch.launchAt} estimated={!launch.dateConfirmed} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(launch.launchAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!launch.dateConfirmed && <EstimatedDateBadge />}
                  </div>
                </div>
              </DialogTitle>
              <RichText text={launch.description} className="mt-3 block whitespace-pre-wrap text-sm leading-relaxed text-foreground/85" />

              {/* socials */}
              <div className="mt-3 flex flex-wrap gap-2">
                {launch.website && <SocialChip href={launch.website} icon={<Globe className="h-3.5 w-3.5" />} label="Website" />}
                {launch.twitter && <SocialChip href={launch.twitter} icon={<XLogo className="h-3.5 w-3.5" />} label="X" />}
                {launch.telegram && <SocialChip href={launch.telegram} icon={<TelegramLogo className="h-3.5 w-3.5" />} label="Telegram" />}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
                <SafetyChecks lpLocked={launch.lpLocked} mintRevoked={launch.mintRevoked} top10Pct={launch.top10Pct} />
              </div>

              {/* Datos Premium: lo que se ve, más una fila borrosa por cada dato que el launch tiene pero no se puede ver */}
              {(launch.devWallet || launch.launchpad || launch.lockedFields.length > 0) && (
                <div className="mt-3 space-y-1.5">
                  {launch.devWallet && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-400">
                        <Wallet className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Wallet del dev</p>
                        <CopyCA contract={launch.devWallet} className="border-0 bg-transparent p-0 text-[13px]" />
                      </div>
                    </div>
                  )}
                  {launch.launchpad && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-400">
                        <Rocket className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Launchpad</p>
                        <p className="text-[13px] font-semibold">{launch.launchpad}</p>
                      </div>
                    </div>
                  )}
                  {launch.lockedFields.includes('devWallet') && (
                    <PremiumLockedRow
                      icon={<Wallet className="h-3.5 w-3.5" aria-hidden />}
                      label="Wallet del dev"
                      fakeValue="7xKXt••••••••••••••••••••••JosgAsU"
                      onUnlock={() => setPremiumOpen(true)}
                    />
                  )}
                  {launch.lockedFields.includes('launchpad') && (
                    <PremiumLockedRow
                      icon={<Rocket className="h-3.5 w-3.5" aria-hidden />}
                      label="Launchpad"
                      fakeValue="████████"
                      onUnlock={() => setPremiumOpen(true)}
                    />
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/u/${launch.createdBy.handle}`}
                    onClick={() => openLaunch(null)}
                    aria-label={`Perfil de @${launch.createdBy.handle}`}
                  >
                    <UserAvatar name={launch.createdBy.name} handle={launch.createdBy.handle} src={launch.createdBy.avatar} size="sm" verified={launch.createdBy.walletVerified} official={launch.createdBy.verified} />
                  </Link>
                  <div>
                    <Link
                      href={`/u/${launch.createdBy.handle}`}
                      onClick={() => openLaunch(null)}
                      className="text-[13px] font-semibold hover:underline"
                    >
                      {launch.createdBy.name}
                    </Link>
                    {launch.createdBy.verified && <OfficialBadge className="ml-1 align-middle" />}
                    {/* Reputación de la persona, no del proyecto: el fueguito
                        ya mide las ganas que hay por el launch. */}
                    <TrustBadge
                      rep={launch.createdBy.reputation}
                      handle={launch.createdBy.handle}
                      className="ml-1.5 align-middle"
                    />
                    <button
                      onClick={() => !launch.createdBy.isFollowed && follow.mutate(launch.createdBy.id)}
                      className="block truncate text-[11px] text-muted-foreground hover:text-primary"
                    >
                      @{launch.createdBy.handle} · {launch.createdBy.isFollowed ? 'siguiendo' : 'seguir'}
                    </button>
                  </div>
                </div>
                {/* Solo quien lo publicó o un admin: lo decide el servidor (canEdit) */}
                {launch.canEdit && (
                  <Link
                    href={`/publicar?edit=${launch.id}`}
                    onClick={() => openLaunch(null)}
                    className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#8FA83F]/50 hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
                  </Link>
                )}
                <button
                  onClick={() => hype.mutate(launch.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition-all active:scale-95',
                    !launch.canEdit && 'ml-auto',
                    launch.hyped
                      ? 'border-[#8FA83F]/50 bg-[#8FA83F]/15 text-primary neon-shadow'
                      : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/50 hover:text-primary'
                  )}
                >
                  <Flame className={cn('h-4 w-4', launch.hyped && 'fill-primary')} />
                  {launch.hype}
                </button>
                {/* Voto en contra: solo cuenta con un motivo escrito, que se
                    publica como comentario aquí abajo. */}
                <FudButton launchId={launch.id} fud={launch.fud} fudded={launch.fudded} size="md" />
                <ReminderBell launchId={launch.id} launchAt={launch.launchAt} size="md" />
                <BoostButton
                  target={{ type: 'launch', id: launch.id, name: launch.ticker ?? launch.name, image: launch.image }}
                  boost={launch.boost}
                />
              </div>

              {/* Quien lo publicó puede pedir la insignia de launch oficial (perk Premium) */}
              {me?.id === launch.createdBy.id && (
                <div className="mt-3">
                  <VerifyRequestRow kind="launch" launchId={launch.id} verified={launch.verified} />
                </div>
              )}

              {/* Rol de quien publicó: dev del proyecto o scout de la comunidad */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {launch.submitterRole === 'dev' ? (
                  <>
                    <span className="inline-flex items-center rounded-full bg-[#8FA83F]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
                      DEV
                    </span>
                    <span className="text-[11px] text-muted-foreground">Dev del proyecto</span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                      SCOUT
                    </span>
                    <span className="text-[11px] text-muted-foreground">Encontrado por la comunidad</span>
                  </>
                )}
              </div>
            </div>

            {/* Transmisión en vivo (el admin/dev marcó el launch como live y pegó el link del stream) */}
            {launch.isLive && launch.liveUrl && (
              <section className="border-b border-white/10 p-4" aria-label="Transmisión en vivo del lanzamiento">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff4d5e] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff4d5e]" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    En vivo ahora
                  </p>
                  <a
                    href={launch.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                  >
                    Abrir en la plataforma original ↗
                  </a>
                </div>
                <LiveEmbed url={launch.liveUrl} title={`Transmisión en vivo de ${launch.name}`} />
              </section>
            )}

            {/* Gráfico en vivo + panel de compra (solo si el launch tiene CA del token desplegado) */}
            {launch.contract ? (
              <section className="border-b border-white/10 p-4" aria-label="Gráfico en vivo y compra del token">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gráfico en vivo</p>
                  <CopyCA contract={launch.contract} className="min-w-0 max-w-full text-[10px] sm:max-w-[60%]" />
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <LiveChart network={launch.network} contract={launch.contract} height={expanded ? 560 : 400} />
                    <ExternalLinksRow network={launch.network} contract={launch.contract} ticker={launch.ticker ?? undefined} className="mt-2.5" />
                  </div>
                  <TradePanel
                    contract={launch.contract}
                    network={launch.network}
                    ticker={launch.ticker ?? launch.name}
                    className={expanded ? 'lg:w-[340px]' : 'lg:w-[300px]'}
                  />
                </div>
              </section>
            ) : launch.lockedFields.includes('contract') ? (
              // El contrato ya existe (el launch aún no ha salido) pero es dato Premium
              <section className="border-b border-white/10 p-4" aria-label="Contrato bloqueado">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gráfico en vivo</p>
                <button
                  type="button"
                  onClick={() => setPremiumOpen(true)}
                  className="group flex w-full flex-col items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] py-8 text-center transition-colors hover:border-amber-400/45"
                >
                  <Lock className="h-6 w-6 text-amber-300" aria-hidden />
                  <span className="text-sm font-bold text-amber-200">El contrato ya existe</span>
                  <span className="max-w-xs text-[12px] text-muted-foreground">
                    Los suscriptores Premium lo ven antes del lanzamiento, junto al gráfico en vivo en cuanto salga
                  </span>
                  <span className="mt-1 flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#171200] transition-colors group-hover:bg-amber-300">
                    <Crown className="h-3.5 w-3.5 fill-[#171200]" aria-hidden /> Hazte Pro
                  </span>
                </button>
              </section>
            ) : null}

            {/* Comments / tesis */}
            <div className="p-4">
              <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tesis y comentarios de la comunidad · {launch.posts.length}
              </p>
              <div className="mb-3 rounded-xl border border-white/10 bg-[#0a0b08] p-2.5">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={`¿Por qué este launch va a ser grande? Escribir tesis = +${rules.points_thesis} puntos`}
                  className="min-h-[64px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
                  aria-label="Escribir comentario"
                />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-primary/80">
                    <Zap className="h-3 w-3" aria-hidden /> Tesis +{rules.points_thesis} · Comentario +{rules.points_comment}
                  </span>
                  <Button
                    size="sm"
                    disabled={!comment.trim() || createPost.isPending}
                    onClick={() => {
                      createPost.mutate(
                        { kind: comment.length > 80 ? 'thesis' : 'comment', content: comment, launchId: launch.id },
                        { onSuccess: () => setComment('') }
                      )
                    }}
                    className="px-4 text-xs font-bold"
                  >
                    Publicar
                  </Button>
                </div>
              </div>
              <div className="space-y-2.5 sm:max-h-[40dvh] sm:overflow-y-auto sm:pr-1">
                {launch.posts.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sé el primero en dar tu tesis</p>
                )}
                {launch.posts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Convierte el link del stream a URL de reproductor embebible.
 * Soporta YouTube (watch, live, youtu.be, shorts), Vimeo y Twitch.
 * Devuelve null si la plataforma no tiene embed conocido → se muestra un botón de enlace.
 */
export function toEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    // YouTube: /watch?v=ID, /live/ID, /embed/ID, /shorts/ID, youtu.be/ID
    if (host === 'youtube.com' || host === 'youtu.be') {
      let id = ''
      if (host === 'youtu.be') {
        id = u.pathname.slice(1).split('/')[0]
      } else if (u.pathname.startsWith('/live/') || u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) {
        id = u.pathname.split('/')[2] ?? ''
      } else if (u.pathname === '/watch') {
        id = u.searchParams.get('v') ?? ''
      }
      if (!id) return null
      // autoplay silenciado (permitido por los navegadores) · el usuario destapa el audio desde el reproductor
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&rel=0`
    }
    // Vimeo: vimeo.com/ID
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/')[1]
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}?autoplay=1&muted=1` : null
    }
    // Twitch: twitch.tv/CANAL (el parent es obligatorio)
    if (host === 'twitch.tv') {
      const channel = u.pathname.split('/')[1]
      if (!channel) return null
      if (typeof window === 'undefined') return null
      return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${window.location.hostname}&autoplay=true&muted=true`
    }
    return null
  } catch {
    return null
  }
}

/**
 * Reproductor de la transmisión en vivo: iframe 16:9 para plataformas con embed
 * (YouTube/Vimeo/Twitch) o tarjeta con botón para abrir el link en una pestaña nueva.
 */
function LiveEmbed({ url, title }: { url: string; title: string }) {
  const embed = useMemo(() => toEmbedUrl(url), [url])
  if (!embed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0a0b08] text-center transition-colors hover:border-[#8FA83F]/40"
      >
        <MonitorPlay className="h-8 w-8 text-primary" aria-hidden />
        <span className="text-sm font-bold">Ver transmisión en vivo</span>
        <span className="text-[11px] text-muted-foreground">Se abre en una pestaña nueva ↗</span>
      </a>
    )
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
      <iframe
        src={embed}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

function SocialChip({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-foreground/85 transition-colors hover:border-[#8FA83F]/50 hover:text-primary"
    >
      {icon}
      {label}
      <span className="text-[10px] text-muted-foreground">↗</span>
    </a>
  )
}

export { timeAgo }

/**
 * Banner del launch. Las imágenes de IPFS pasan por la copia del servidor, y si
 * aun así no carga, el bloque desaparece entero: mejor sin banner que con el
 * icono de imagen rota y su texto alternativo encima de la ficha.
 */
function LaunchBanner({ src, name }: { src?: string | null; name: string }) {
  const url = displayImageUrl(src)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!url || failedUrl === url) return null
  return (
    <div className="relative h-32 w-full overflow-hidden sm:h-40">
      <Image
        src={url}
        alt={`Banner de ${name}`}
        fill
        sizes="576px"
        className="object-cover"
        unoptimized
        onError={() => setFailedUrl(url)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#121410] to-transparent" />
    </div>
  )
}
