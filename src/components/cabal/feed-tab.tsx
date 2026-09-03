'use client'

import { useState } from 'react'
import { Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { EmojiAvatar } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { useCreatePost, useFeed, useMe } from '@/lib/api-client'
import { useUI } from '@/lib/store'

const KINDS = [
  { key: 'thesis', label: '🎓 Tesis', hint: '+25 ⚡' },
  { key: 'call', label: '📣 Call', hint: '' },
  { key: 'comment', label: '💬 Comentario', hint: '+5 ⚡' },
]

export function FeedTab() {
  const { data: feed, isLoading } = useFeed()
  const { data: me } = useMe()
  const createPost = useCreatePost()
  const [content, setContent] = useState('')
  const [kind, setKind] = useState('comment')

  const submit = () => {
    if (!content.trim()) return
    createPost.mutate(
      { kind, content },
      {
        onSuccess: () => setContent(''),
      }
    )
  }

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="card-surface rounded-xl border border-[#00ff88]/15 p-3.5">
        <div className="flex gap-3">
          <EmojiAvatar emoji={me?.avatar ?? '🐺'} size="md" />
          <div className="flex-1">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Comparte una tesis, un call o tu último movimiento… la comunidad lee antes de comprar."
              className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
              aria-label="Escribir post"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                    kind === k.key
                      ? 'border-[#00ff88]/50 bg-[#00ff88]/10 text-primary'
                      : 'border-[#00ff88]/12 text-muted-foreground hover:border-[#00ff88]/30'
                  )}
                >
                  {k.label} {k.hint && <span className="text-primary/70">{k.hint}</span>}
                </button>
              ))}
              <Button
                size="sm"
                onClick={submit}
                disabled={!content.trim() || createPost.isPending}
                className="ml-auto h-8 gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-[#00ff88]"
              >
                <Zap className="h-3 w-3" /> Publicar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Points explainer strip */}
      <div className="flex items-center gap-2.5 rounded-xl border border-[#00ff88]/12 bg-gradient-to-r from-[#00ff88]/6 to-transparent px-3.5 py-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-[12px] leading-relaxed text-foreground/80">
          <span className="font-bold text-primary">Puntos Cabal:</span> tesis +25 ⚡ · launch publicado +40 ⚡ · likes recibidos +2 ⚡ · se canjean por tokens del launch de $CABAL 🟢
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-[#00ff88]/8 bg-[#0b120d]" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(feed ?? []).map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  )
}
