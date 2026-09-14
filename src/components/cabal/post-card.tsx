'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Download, Heart, ImageDown, MessageCircle, Send, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopyCA, KindBadge, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { QuickBuyButton } from '@/components/cabal/quick-buy'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { fmtMc, fmtPct, timeAgo } from '@/lib/cabal'
import { useCallResult, useFollowToggle, useLikeToggle } from '@/lib/api-client'
import {
  canCopyImages,
  copyImage,
  downloadImage,
  fetchCardFile,
  prefersNativeShare,
  shareNative,
} from '@/lib/share-image'
import { useUI } from '@/lib/store'
import type { PostDTO } from '@/lib/types'

function fmtX(n: number): string {
  return `${n.toFixed(n >= 10 ? 0 : 1)}x`
}

/**
 * Logo del token de una call. Cuando la call viene de un token ya conocido
 * en Cabal (`post.token`) se usa esa imagen; si es un CA suelto (pegado a
 * mano, sin token vinculado) se cae al resultado en vivo (`useCallResult`),
 * que ya resuelve el logo vía DexScreener/pump.fun — antes esas calls se
 * quedaban con el "?" de siempre.
 */
function CallTokenGlyph({ post }: { post: PostDTO }) {
  const { data } = useCallResult(post.id, post.kind === 'call' && !!post.contract && !post.token)
  const src = post.token?.image ?? data?.image ?? null
  const ticker = post.token?.ticker ?? (data?.symbol ? data.symbol : '?')
  return <TokenGlyph src={src} ticker={ticker} size="xs" />
}

/** Botón de comprar el token de la call, directo desde el feed (solo Solana por ahora). */
function CallBuyButton({ post }: { post: PostDTO }) {
  const { data } = useCallResult(post.id, post.kind === 'call' && !!post.contract && !post.token)
  if (!post.contract || !post.network) return null
  const ticker = post.token?.ticker ?? data?.symbol ?? ''
  return <QuickBuyButton contract={post.contract} network={post.network} ticker={ticker} className="shrink-0" />
}

/** Estado de la call en una sola línea: monto compacto, sin envolver a varias filas. */
function CallResultBadge({ post }: { post: PostDTO }) {
  const { data } = useCallResult(post.id, post.kind === 'call' && !!post.contract)
  if (!data?.found || data.pctChange === null) return null
  const up = data.pctChange >= 0
  const showMc = data.currentMc !== null
  // El pico (lo más alto que llegó a hacer desde la call, aunque después haya
  // bajado) es el dato que más pesa: si hubo 2x o más ahí, manda sobre el %
  // actual, que queda como dato secundario.
  const hasPeak = data.peakMultiple !== null && data.peakMultiple >= 2
  const showMultiple = !hasPeak && up && data.multiple !== null && data.multiple >= 2

  if (hasPeak) {
    return (
      <span
        className="flex min-w-0 shrink items-center gap-1 truncate text-primary"
        title="Máximo alcanzado desde que se publicó la call"
      >
        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-[12px] font-extrabold">llegó a {fmtX(data.peakMultiple!)}</span>
        <span className="shrink-0 text-[11px] font-normal opacity-80">· ahora {fmtPct(data.pctChange)}</span>
      </span>
    )
  }

  return (
    <span
      className={cn('flex min-w-0 shrink items-center gap-1 truncate text-[11px] font-bold', up ? 'text-primary' : 'text-red-400')}
      title="Cambio de precio desde que se publicó la call"
    >
      <TrendingUp className={cn('h-3 w-3 shrink-0', !up && 'rotate-180')} />
      <span className="truncate">
        {fmtPct(data.pctChange)}
        {showMultiple ? ` (${fmtX(data.multiple!)})` : ''}
        {showMc ? ` · MC ${fmtMc(data.currentMc!)}` : ''}
      </span>
    </span>
  )
}

/** Popup con la tarjeta de resultado de una call y el botón para compartirla en X. */
function CallShareDialog({ post, open, onOpenChange }: { post: PostDTO; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data } = useCallResult(post.id, open && post.kind === 'call' && !!post.contract)
  const cardPath = `/api/posts/${post.id}/card`

  // Capacidades del navegador: se leen tras montar, igual que en el flujo de
  // la lista de espera, para no descuadrar la hidratación.
  const [nativeShare, setNativeShare] = useState(false)
  const [copyable, setCopyable] = useState(false)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      setNativeShare(prefersNativeShare())
      setCopyable(canCopyImages())
    }, 0)
    return () => clearTimeout(t)
  }, [open])

  // La imagen se descarga por adelantado (dentro del gesto de compartir hay
  // que ser inmediato, sobre todo en Safari), con un cache-buster por si el
  // resultado cambió desde la última vez que se abrió este popup.
  const [loaded, setLoaded] = useState<{ url: string; file: File } | null>(null)
  const absCardUrl = typeof window !== 'undefined' ? `${window.location.origin}${cardPath}?t=${Date.now()}` : cardPath
  const cardFile = loaded?.url === cardPath ? loaded.file : null
  useEffect(() => {
    if (!open) return
    let alive = true
    fetchCardFile(absCardUrl, post.user.handle)
      .then((file) => alive && setLoaded({ url: cardPath, file }))
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cardPath])

  const [copied, setCopied] = useState(false)

  const symbol = data?.symbol ? `$${data.symbol}` : '$token'
  const hasPeak = data?.peakMultiple !== null && (data?.peakMultiple ?? 0) >= 2
  const headline =
    hasPeak && data
      ? `${symbol} llegó a hacer ${fmtX(data.peakMultiple!)} desde esta call`
      : data?.pctChange !== null && data
        ? `${symbol} va ${fmtPct(data.pctChange)} desde esta call`
        : `Resultado de la call de ${symbol}`
  const shareText = `${headline} en @cabalarmy 🐺`
  const intentUrl = `https://x.com/intent/post?${new URLSearchParams({ text: shareText, url: 'https://cabal.army' }).toString()}`

  const shareFromDevice = async () => {
    if (!cardFile) return
    try {
      const done = await shareNative(cardFile, `${shareText}\n\nhttps://cabal.army`)
      if (!done) return
    } catch {
      window.open(intentUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const copyCard = async () => {
    if (!cardFile) return
    try {
      await copyImage(cardFile)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // el botón de descargar sigue disponible como respaldo
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Compartir el resultado de la call</DialogTitle>
        <img
          key={cardPath}
          src={cardPath}
          alt={`Resultado de la call, ${symbol}`}
          width={1200}
          height={675}
          className="w-full border-b border-white/10"
        />
        <div className="p-4">
          {/* X no adjunta la imagen desde el intent: en escritorio hay que
              copiarla o descargarla y pegarla a mano en el compositor. */}
          {!nativeShare && (
            <p className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
              Para que la imagen salga en el post:
              {copyable && (
                <>
                  <button
                    type="button"
                    onClick={copyCard}
                    disabled={!cardFile}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copiada' : 'Copiar'}
                  </button>
                  <span aria-hidden>·</span>
                </>
              )}
              <button
                type="button"
                onClick={() => cardFile && downloadImage(cardFile)}
                disabled={!cardFile}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                Descargar
              </button>
              {copyable && <span className="w-full basis-full text-[10.5px] opacity-80">y pégala con Ctrl+V (⌘V en Mac) en el compositor de X.</span>}
            </p>
          )}

          {nativeShare && cardFile ? (
            <Button onClick={shareFromDevice} className="h-11 w-full gap-2 rounded-xl bg-primary text-[14px] font-bold text-primary-foreground hover:bg-[#9dba46]">
              <Send className="h-4 w-4" /> Compartir en X
            </Button>
          ) : (
            <Button asChild className="h-11 w-full gap-2 rounded-xl bg-primary text-[14px] font-bold text-primary-foreground hover:bg-[#9dba46]">
              <a href={intentUrl} target="_blank" rel="noopener noreferrer">
                <Send className="h-4 w-4" /> Compartir en X
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  const [shareOpen, setShareOpen] = useState(false)

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
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
              <CallTokenGlyph post={post} />
              <CopyCA contract={post.contract} className="min-w-0 shrink text-[11px]" />
              <CallResultBadge post={post} />
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                <CallBuyButton post={post} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShareOpen(true)
                  }}
                  className="text-muted-foreground hover:text-primary"
                  title="Ver la tarjeta y compartirla en X"
                  aria-label="Ver imagen para compartir"
                >
                  <ImageDown className="h-3.5 w-3.5" />
                </button>
              </span>
              <CallShareDialog post={post} open={shareOpen} onOpenChange={setShareOpen} />
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
