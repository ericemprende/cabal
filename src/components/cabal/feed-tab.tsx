'use client'

import { useState } from 'react'
import { GraduationCap, Hash, Megaphone, MessageSquare, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { LaunchActivityCard, useActivity } from '@/components/cabal/launch-activity'
import { useCreatePost, useMe } from '@/lib/api-client'
import { useUI } from '@/lib/store'

const KINDS = [
  { key: 'thesis', label: 'Tesis', icon: GraduationCap, hint: '+25' },
  { key: 'call', label: 'Call', icon: Megaphone, hint: '' },
  { key: 'comment', label: 'Comentario', icon: MessageSquare, hint: '+5' },
]

export function FeedTab() {
  const { items: activity, isLoading } = useActivity(60)
  const { openLaunch } = useUI()
  const { data: me } = useMe()
  const createPost = useCreatePost()
  const [content, setContent] = useState('')
  const [kind, setKind] = useState('comment')
  const [contract, setContract] = useState('')

  const isCall = kind === 'call'
  const contractOk = /^[a-zA-Z0-9:_-]{2,80}$/.test(contract.trim())
  const canSubmit = content.trim() && (!isCall || contractOk)

  const submit = () => {
    if (!canSubmit) return
    createPost.mutate(
      { kind, content, contract: isCall ? contract.trim() : undefined },
      {
        onSuccess: () => {
          setContent('')
          setContract('')
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="card-surface rounded-xl border border-white/10 p-3.5">
        <div className="flex gap-3">
          <UserAvatar name={me?.name} handle={me?.handle} src={me?.avatar} size="md" />
          <div className="flex-1">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Comparte una tesis, un call o tu último movimiento… la comunidad lee antes de comprar."
              className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
              aria-label="Escribir post"
            />
            {isCall && (
              <div className="mt-2 flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
                <Input
                  value={contract}
                  onChange={(e) => setContract(e.target.value)}
                  placeholder="CA / contrato del token (obligatorio para una call)"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-8 bg-[#0a0b08] font-mono text-xs"
                  aria-label="Contrato del token"
                />
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                    kind === k.key
                      ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                      : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30'
                  )}
                >
                  <k.icon className="h-3.5 w-3.5" aria-hidden />
                  {k.label}
                  {k.hint && (
                    <span className="flex items-center gap-0.5 text-primary/70">
                      {k.hint}
                      <Zap className="h-2.5 w-2.5" aria-hidden />
                    </span>
                  )}
                </button>
              ))}
              <Button
                size="sm"
                onClick={submit}
                disabled={!canSubmit || createPost.isPending}
                className="ml-auto h-8 gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
              >
                <Zap className="h-3 w-3" /> Publicar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Points explainer strip */}
      <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-gradient-to-r from-[#8FA83F]/8 to-transparent px-3.5 py-2.5">
        <Zap className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-[12px] leading-relaxed text-foreground/80">
          <span className="font-bold text-primary">Puntos Cabal:</span> tesis +25 · launch publicado +40 · likes recibidos +2 · se canjean por tokens del airdrop de $CABAL
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-white/8 bg-[#121410]" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map((item) =>
            item.type === 'launch' ? (
              <LaunchActivityCard key={`launch-${item.launch.id}`} launch={item.launch} onOpen={() => openLaunch(item.launch.id)} />
            ) : (
              <PostCard key={item.post.id} post={item.post} />
            )
          )}
        </div>
      )}
    </div>
  )
}
