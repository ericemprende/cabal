'use client'

import Link from 'next/link'
import { Heart, ImageDown, MessageCircle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopyCA, KindBadge, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { fmtMc, fmtPct, timeAgo } from '@/lib/cabal'
import { useCallResult, useFollowToggle, useLikeToggle } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import type { PostDTO } from '@/lib/types'

function fmtX(n: number): string {
  return `${n.toFixed(n >= 10 ? 0 : 1)}x`
}

function CallResultBadge({ post }: { post: PostDTO }) {
  const { data } = useCallResult(post.id, post.kind === 'call' && !!post.contract)
  if (!data?.found || data.pctChange === null) return null
  const up = data.pctChange >= 0
  const showMc = data.entryMc !== null && data.currentMc !== null
  // El pico (lo más alto que llegó a hacer desde la call, aunque después haya
  // bajado) es el dato que más pesa: si hubo 2x o más ahí, va primero y en
  // grande; el % actual queda como dato secundario.
  const hasPeak = data.peakMultiple !== null && data.peakMultiple >= 2
  const showMultiple = !hasPeak && up && data.multiple !== null && data.multiple >= 2

  if (hasPeak) {
    return (
      <span
        className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md bg-[#8FA83F]/10 px-1.5 py-0.5 text-primary"
        title="Máximo alcanzado desde que se publicó la call"
      >
        <span className="flex items-center gap-1 text-sm font-extrabold">
          <TrendingUp className="h-3.5 w-3.5" />
          llegó a hacer {fmtX(data.peakMultiple!)}
        </span>
        <span className="text-[11px] font-normal opacity-80">
          · ahora {fmtPct(data.pctChange)}
          {showMc ? ` · MC ${fmtMc(data.entryMc!)} → pico ${fmtMc(data.peakMc!)} → ahora ${fmtMc(data.currentMc!)}` : ''}
        </span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'flex flex-wrap items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold',
        up ? 'bg-[#8FA83F]/10 text-primary' : 'bg-red-500/10 text-red-400'
      )}
      title="Cambio de precio desde que se publicó la call"
    >
      <TrendingUp className={cn('h-3 w-3', !up && 'rotate-180')} />
      {fmtPct(data.pctChange)}
      {showMultiple ? ` (${fmtX(data.multiple!)})` : ''}
      {' desde la call'}
      {showMc ? (
        <span className="font-normal opacity-80">
          · MC {fmtMc(data.entryMc!)} → {fmtMc(data.currentMc!)}
        </span>
      ) : null}
    </span>
  )
}

export function PostCard({
  post,
  compact,
  onComment,
}: {
  post: PostDTO
  compact?: boolean
  onComment?: () => void
}) {
  const like = useLikeToggle()
  const follow = useFollowToggle()
  const { openLaunch, openToken } = useUI()

  return (
    <article
      className={cn(
        'card-surface rounded-xl border border-white/10 transition-colors hover:border-white/12',
        compact ? 'p-2.5' : 'p-3.5'
      )}
    >
      <div className="flex items-start gap-2.5">
        <Link href={`/u/${post.user.handle}`} className="shrink-0" aria-label={`Perfil de @${post.user.handle}`}>
          <UserAvatar name={post.user.name} handle={post.user.handle} src={post.user.avatar} size={compact ? 'sm' : 'md'} verified={post.user.walletVerified} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link href={`/u/${post.user.handle}`} className="flex min-w-0 items-center gap-x-1.5 hover:underline">
              <span className={cn('truncate font-semibold', compact ? 'text-[13px]' : 'text-sm')}>{post.user.name}</span>
              <span className="truncate text-xs text-muted-foreground">@{post.user.handle}</span>
            </Link>
            <button
              className="text-[10px] font-semibold text-primary/70 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation()
                if (!post.user.isFollowed && post.user.id) follow.mutate(post.user.id)
              }}
            >
              {post.user.isFollowed ? '· siguiendo' : '· seguir'}
            </button>
            <span className="ml-auto flex items-center gap-1.5">
              <KindBadge kind={post.kind} />
              <span className="text-[11px] text-muted-foreground">{timeAgo(post.createdAt)}</span>
            </span>
          </div>

          <p className={cn('mt-1.5 whitespace-pre-wrap break-words leading-relaxed text-foreground/90', compact ? 'line-clamp-3 text-[13px]' : 'text-sm')}>
            {post.content}
          </p>

          {post.kind === 'call' && post.contract && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
              <CopyCA contract={post.contract} className="text-[11px]" />
              <CallResultBadge post={post} />
              <a
                href={`/api/posts/${post.id}/card`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary hover:text-[#a9c95a]"
                title="Ver/descargar imagen con el resultado para compartir"
              >
                <ImageDown className="h-3.5 w-3.5" /> imagen
              </a>
            </div>
          )}

          {/* linked target */}
          {post.launch && (
            <button
              onClick={() => openLaunch(post.launch!.id)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition-colors hover:border-[#8FA83F]/35"
            >
              <TokenGlyph src={post.launch.image} ticker={post.launch.ticker ?? post.launch.name} size="xs" />
              <span className="text-xs font-semibold">
                {post.launch.isPrivate || !post.launch.ticker ? (
                  <span className="text-amber-300/90">Privado</span>
                ) : (
                  post.launch.ticker
                )}{' '}
                <span className="font-normal text-muted-foreground">launch</span>
              </span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-primary">ver en radar →</span>
            </button>
          )}
          {post.token && (
            <button
              onClick={() => openToken(post.token!.id)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition-colors hover:border-[#8FA83F]/35"
            >
              <TokenGlyph src={post.token.image} ticker={post.token.ticker} size="xs" />
              <span className="text-xs font-semibold">
                {post.token.ticker} <span className="font-normal text-muted-foreground">{fmtMc(post.token.mc)} MC</span>
              </span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-primary">ver token →</span>
            </button>
          )}

          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={() => like.mutate(post.id)}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                post.liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
              )}
              aria-label="Me gusta"
            >
              <Heart className={cn('h-3.5 w-3.5', post.liked && 'fill-primary')} />
              {post.likes}
            </button>
            {onComment && (
              <button onClick={onComment} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary" aria-label="Comentar">
                <MessageCircle className="h-3.5 w-3.5" />
                Responder
              </button>
            )}
            {typeof post.pnl === 'number' && post.pnl > 0 && (
              <span className="ml-auto flex items-center gap-1 rounded-md bg-[#8FA83F]/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                <TrendingUp className="h-3 w-3" /> +${post.pnl.toLocaleString('es')}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
