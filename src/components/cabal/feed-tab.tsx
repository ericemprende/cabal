'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, GraduationCap, Hash, Loader2, Megaphone, MessageSquare, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { NETWORKS } from '@/lib/cabal'
import { NetworkIcon, UserAvatar } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { LaunchActivityCard, useActivity } from '@/components/cabal/launch-activity'
import { useCreatePost, useMe, usePointRules } from '@/lib/api-client'
import type { TokenMeta } from '@/lib/chain-stats'
import { useUI } from '@/lib/store'

export function FeedTab() {
  const rules = usePointRules()
  const KINDS = [
    { key: 'thesis', label: 'Tesis', icon: GraduationCap, hint: `+${rules.points_thesis}` },
    { key: 'call', label: 'Call', icon: Megaphone, hint: '' },
    { key: 'comment', label: 'Comentario', icon: MessageSquare, hint: `+${rules.points_comment}` },
  ]
  const { items: activity, isLoading } = useActivity(60)
  const { openLaunch } = useUI()
  const { data: me } = useMe()
  const createPost = useCreatePost()
  const [content, setContent] = useState('')
  const [kind, setKind] = useState('comment')
  const [contract, setContract] = useState('')
  const [network, setNetwork] = useState('solana')

  const isCall = kind === 'call'
  const contractOk = /^[a-zA-Z0-9:_-]{2,80}$/.test(contract.trim())
  const canSubmit = content.trim() && (!isCall || contractOk)

  // Verificación en vivo del contrato antes de publicar: busca en DexScreener /
  // pump.fun (misma fuente que usa la card de la call luego) y auto-detecta la
  // red, para que no se publique una call que después no se detecta.
  const [lookup, setLookup] = useState<{ state: 'idle' | 'loading' | 'found' | 'notfound'; meta?: TokenMeta }>({
    state: 'idle',
  })
  useEffect(() => {
    const ca = contract.trim()
    if (!isCall || !/^[a-zA-Z0-9]{32,44}$|^0x[a-fA-F0-9]{40}$/.test(ca)) {
      setLookup({ state: 'idle' })
      return
    }
    let cancelled = false
    setLookup({ state: 'loading' })
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tokens/lookup?ca=${encodeURIComponent(ca)}`)
        const meta = (await res.json()) as TokenMeta
        if (cancelled) return
        if (!res.ok || !meta.found) {
          setLookup({ state: 'notfound' })
          return
        }
        if (meta.network) setNetwork(meta.network)
        setLookup({ state: 'found', meta })
      } catch {
        if (!cancelled) setLookup({ state: 'notfound' })
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [contract, isCall])

  const submit = () => {
    if (!canSubmit) return
    createPost.mutate(
      { kind, content, contract: isCall ? contract.trim() : undefined, network: isCall ? network : undefined },
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
              className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-base focus-visible:ring-0 sm:text-sm"
              aria-label="Escribir post"
            />
            {isCall && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
                  <Input
                    value={contract}
                    onChange={(e) => setContract(e.target.value)}
                    placeholder="CA / contrato del token (obligatorio para una call)"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-8 bg-[#0a0b08] font-mono text-base sm:text-xs"
                    aria-label="Contrato del token"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(NETWORKS).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => setNetwork(key)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all',
                        network === key
                          ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                          : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
                      )}
                    >
                      <NetworkIcon network={key} className="h-3 w-3" />
                      {meta.short}
                    </button>
                  ))}
                </div>
                {lookup.state === 'loading' && (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Verificando contrato…
                  </p>
                )}
                {lookup.state === 'found' && (
                  <p className="flex items-center gap-1.5 text-[11px] text-primary">
                    <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                    {lookup.meta?.symbol ? `$${lookup.meta.symbol}` : 'Token'} detectado en{' '}
                    {lookup.meta?.source === 'pumpfun' ? 'pump.fun' : 'DexScreener'}
                    {lookup.meta?.image ? ' · con imagen' : ' · sin imagen todavía'} · red {NETWORKS[network]?.short ?? network}
                  </p>
                )}
                {lookup.state === 'notfound' && (
                  <p className="flex items-center gap-1.5 text-[11px] text-amber-500">
                    <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                    No lo encontramos en DexScreener ni pump.fun. Revisa el contrato o la red antes de publicar: puede que no aparezca la imagen ni el resultado en vivo.
                  </p>
                )}
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
                className="ml-auto gap-1.5 px-4 text-xs font-bold"
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
          <span className="font-bold text-primary">Puntos Cabal:</span> tesis +{rules.points_thesis} · launch publicado +{rules.points_launch} · likes recibidos +{rules.points_like_received} · se canjean por tokens del airdrop de $CABAL
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
              <LaunchActivityCard
                key={`launch-${item.kind}-${item.launch.id}`}
                launch={item.launch}
                kind={item.kind}
                onOpen={() => openLaunch(item.launch.id)}
              />
            ) : (
              <PostCard key={item.post.id} post={item.post} />
            ) /* PostCard ya trae su propio "Responder" con caja de respuesta inline */
          )}
        </div>
      )}
    </div>
  )
}
