'use client'

import { Heart, MessageCircle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmojiAvatar, KindBadge } from '@/components/cabal/shared'
import { fmtMc, fmtPct, timeAgo } from '@/lib/cabal'
import { useFollowToggle, useLikeToggle } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import type { PostDTO } from '@/lib/types'

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
        'card-surface rounded-xl border border-[#00ff88]/10 transition-colors hover:border-[#00ff88]/25',
        compact ? 'p-2.5' : 'p-3.5'
      )}
    >
      <div className="flex items-start gap-2.5">
        <EmojiAvatar emoji={post.user.avatar} size={compact ? 'sm' : 'md'} verified={post.user.walletVerified} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className={cn('truncate font-semibold', compact ? 'text-[13px]' : 'text-sm')}>{post.user.name}</span>
            <span className="truncate text-xs text-muted-foreground">@{post.user.handle}</span>
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

          {/* linked target */}
          {post.launch && (
            <button
              onClick={() => openLaunch(post.launch!.id)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[#00ff88]/15 bg-[#00ff88]/5 px-2.5 py-1.5 text-left transition-colors hover:border-[#00ff88]/35"
            >
              <span aria-hidden>{post.launch.emoji}</span>
              <span className="text-xs font-semibold">
                {post.launch.ticker} <span className="font-normal text-muted-foreground">launch</span>
              </span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-primary">ver en radar →</span>
            </button>
          )}
          {post.token && (
            <button
              onClick={() => openToken(post.token!.id)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[#00ff88]/15 bg-[#00ff88]/5 px-2.5 py-1.5 text-left transition-colors hover:border-[#00ff88]/35"
            >
              <span aria-hidden>{post.token.emoji}</span>
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
              <span className="ml-auto flex items-center gap-1 rounded-md bg-[#00ff88]/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                <TrendingUp className="h-3 w-3" /> +${post.pnl.toLocaleString('es')}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
