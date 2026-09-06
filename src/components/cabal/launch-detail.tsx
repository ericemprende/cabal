'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Flame, Globe, MonitorPlay, Send, Twitter, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CountdownPill, CopyCA, NetworkBadge, SafetyChecks, TickerLabel, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { ExternalLinksRow, LiveChart } from '@/components/cabal/live-chart'
import { timeAgo } from '@/lib/cabal'
import { useCreatePost, useFollowToggle, useHypeToggle, useLaunch } from '@/lib/api-client'
import { useUI } from '@/lib/store'

export function LaunchDetailDialog() {
  const { launchDetailId, openLaunch } = useUI()
  const { data: launch, isLoading } = useLaunch(launchDetailId)
  const hype = useHypeToggle()
  const follow = useFollowToggle()
  const createPost = useCreatePost()
  const [comment, setComment] = useState('')

  return (
    <Dialog
      open={!!launchDetailId}
      onOpenChange={(v) => {
        if (!v) {
          openLaunch(null)
          setComment('')
        }
      }}
    >
      <DialogContent
        className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-xl"
        aria-describedby={undefined}
      >
        {isLoading || !launch ? (
          <div className="space-y-3 p-6">
            <DialogTitle className="sr-only">Detalle del lanzamiento</DialogTitle>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            {launch.banner && (
              <div className="relative h-32 w-full overflow-hidden sm:h-40">
                <Image src={launch.banner} alt={`Banner de ${launch.name}`} fill sizes="576px" className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121410] to-transparent" />
              </div>
            )}
            <div className="relative border-b border-white/10 p-5">
              <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#8FA83F]/8 blur-3xl" />
              <DialogTitle className="flex items-start gap-3 text-left">
                <TokenGlyph src={launch.image} ticker={launch.ticker ?? launch.name} size="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="font-display flex min-w-0 flex-wrap items-center gap-x-2 text-xl font-bold">
                      <span className="min-w-0 truncate">{launch.name}</span>
                      <TickerLabel ticker={launch.ticker} isPrivate={launch.isPrivate} className="text-primary" />
                    </h2>
                    <NetworkBadge network={launch.network} />
                  </div>
                  {launch.isPrivate && !launch.ticker && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-300/90">
                      Ticker reservado · se revela en el bloque 1
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <CountdownPill target={launch.launchAt} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(launch.launchAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </DialogTitle>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{launch.description}</p>

              {/* socials */}
              <div className="mt-3 flex flex-wrap gap-2">
                {launch.website && <SocialChip href={launch.website} icon={<Globe className="h-3.5 w-3.5" />} label="Website" />}
                {launch.twitter && <SocialChip href={launch.twitter} icon={<Twitter className="h-3.5 w-3.5" />} label="X / Twitter" />}
                {launch.telegram && <SocialChip href={launch.telegram} icon={<Send className="h-3.5 w-3.5" />} label="Telegram" />}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
                <SafetyChecks lpLocked={launch.lpLocked} mintRevoked={launch.mintRevoked} top10Pct={launch.top10Pct} />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <UserAvatar name={launch.createdBy.name} handle={launch.createdBy.handle} src={launch.createdBy.avatar} size="sm" verified={launch.createdBy.walletVerified} />
                  <div>
                    <p className="text-[13px] font-semibold">{launch.createdBy.name}</p>
                    <button
                      onClick={() => !launch.createdBy.isFollowed && follow.mutate(launch.createdBy.id)}
                      className="text-[11px] text-muted-foreground hover:text-primary"
                    >
                      @{launch.createdBy.handle} · {launch.createdBy.isFollowed ? 'siguiendo' : 'seguir'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => hype.mutate(launch.id)}
                  className={cn(
                    'ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition-all active:scale-95',
                    launch.hyped
                      ? 'border-[#8FA83F]/50 bg-[#8FA83F]/15 text-primary neon-shadow'
                      : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/50 hover:text-primary'
                  )}
                >
                  <Flame className={cn('h-4 w-4', launch.hyped && 'fill-primary')} />
                  {launch.hype}
                </button>
              </div>

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

            {/* Gráfico en vivo (solo si el launch tiene CA del token desplegado) */}
            {launch.contract && (
              <section className="border-b border-white/10 p-4" aria-label="Gráfico en vivo del token">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gráfico en vivo</p>
                  <CopyCA contract={launch.contract} className="max-w-[60%] text-[10px]" />
                </div>
                <LiveChart network={launch.network} contract={launch.contract} height={320} />
                <ExternalLinksRow network={launch.network} contract={launch.contract} className="mt-2.5" />
              </section>
            )}

            {/* Comments / tesis */}
            <div className="p-4">
              <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tesis y comentarios de la comunidad · {launch.posts.length}
              </p>
              <div className="mb-3 rounded-xl border border-white/10 bg-[#0a0b08] p-2.5">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="¿Por qué este launch va a ser grande? Escribir tesis = +25 puntos"
                  className="min-h-[64px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
                  aria-label="Escribir comentario"
                />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-primary/80">
                    <Zap className="h-3 w-3" aria-hidden /> Tesis +25 · Comentario +5
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
                    className="h-8 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
                  >
                    Publicar
                  </Button>
                </div>
              </div>
              <div className="max-h-[40vh] space-y-2.5 overflow-y-auto pr-1">
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
