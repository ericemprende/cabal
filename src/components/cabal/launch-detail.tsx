'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Flame, Globe, Send, Twitter, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CountdownPill, NetworkBadge, SafetyChecks, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
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
                <TokenGlyph src={launch.image} ticker={launch.ticker} size="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display truncate text-xl font-bold">
                      {launch.name} <span className="text-primary">${launch.ticker}</span>
                    </h2>
                    <NetworkBadge network={launch.network} />
                  </div>
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
                  <UserAvatar name={launch.createdBy.name} handle={launch.createdBy.handle} size="sm" verified={launch.createdBy.walletVerified} />
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
            </div>

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
