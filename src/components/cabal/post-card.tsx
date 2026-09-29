'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CandlestickChart, Check, Copy, CornerUpLeft, Download, Heart, ImageDown, MessageCircle, Send, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RichText } from '@/components/cabal/rich-text'
import { useT } from '@/lib/i18n/provider'
import { CopyCA, KindBadge, TokenGlyph, UserAvatar, OfficialBadge } from '@/components/cabal/shared'
import { QuickBuyButton } from '@/components/cabal/quick-buy'
import { ContractResult } from '@/components/cabal/contract-buy'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { fmtMc, fmtPct, shortWallet, timeAgo } from '@/lib/cabal'
import { useCallResult, useCreatePost, useFollowToggle, useLikeToggle, useMe } from '@/lib/api-client'
import {
  canCopyImages,
  copyImage,
  downloadImage,
  fetchCardFile,
  prefersNativeShare,
  shareNative,
} from '@/lib/share-image'
import { useUI } from '@/lib/store'
import type { PostDTO, PostParentDTO } from '@/lib/types'

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

/**
 * Botón de comprar el token de la call, directo desde el feed (solo Solana
 * por ahora). En compact (Actividad del Cabal) solo el ícono: hay poco
 * espacio y el dato del % (CallResultBadge) importa más ahí que el botón.
 */
function CallBuyButton({ post, compact }: { post: PostDTO; compact?: boolean }) {
  const { data } = useCallResult(post.id, post.kind === 'call' && !!post.contract && !post.token)
  if (!post.contract || !post.network) return null
  const ticker = post.token?.ticker ?? data?.symbol ?? ''
  return <QuickBuyButton contract={post.contract} network={post.network} ticker={ticker} className="shrink-0" iconOnly={compact} />
}

/** Estado de la call en una sola línea: monto compacto, sin envolver a varias filas. */
function CallResultBadge({ post }: { post: PostDTO }) {
  const t = useT()
  const { data } = useCallResult(post.id, post.kind === 'call' && !!post.contract)
  if (!data?.found) return null
  // Algunas redes (p. ej. Robinhood) no tienen fuente de velas históricas:
  // no hay forma de saber el % desde la call, pero sí el MC actual.
  if (data.pctChange === null) {
    return data.currentMc !== null ? (
      <span className="truncate text-[11px] font-bold text-muted-foreground">MC {fmtMc(data.currentMc)}</span>
    ) : null
  }
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
        title={t.post.peakTitle}
      >
        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-[12px] font-extrabold">{t.post.reached(fmtX(data.peakMultiple!))}</span>
        <span className="shrink-0 text-[11px] font-normal opacity-80">{t.post.nowPct(fmtPct(data.pctChange))}</span>
      </span>
    )
  }

  return (
    <span
      className={cn('flex min-w-0 shrink items-center gap-1 truncate text-[11px] font-bold', up ? 'text-primary' : 'text-red-400')}
      title={t.post.changeTitle}
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

/**
 * "En respuesta a @fulano: …" encima del comentario. Sin esto, una respuesta
 * suelta en el feed ("le entré, me gusta") no dice a qué token ni a qué call
 * se refiere. Al pulsarla salta al original si está en la misma lista; si no,
 * abre el token o el launch del hilo, que es donde vive.
 */
function ParentQuote({ post, parent, compact }: { post: PostDTO; parent: PostParentDTO; compact?: boolean }) {
  const { openLaunch, openToken } = useUI()
  const t = useT()

  // El mismo post puede estar en el feed y en la barra de actividad a la vez,
  // así que primero se busca al hermano de esta misma lista y solo después en
  // toda la página.
  const jump = (from: HTMLElement) => {
    const list = from.closest('article[data-post-id]')?.parentElement
    const sel = `[data-post-id="${parent.id}"]`
    const el = list?.querySelector<HTMLElement>(sel) ?? document.querySelector<HTMLElement>(sel)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('ring-1', 'ring-[#8FA83F]/60')
      setTimeout(() => el.classList.remove('ring-1', 'ring-[#8FA83F]/60'), 1400)
      return
    }
    if (post.token) openToken(post.token.id)
    else if (post.launch) openLaunch(post.launch.id)
  }

  const label = parent.kind === 'call' ? t.post.toTheCallOf : parent.kind === 'thesis' ? t.post.toTheThesisOf : ''

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        jump(e.currentTarget)
      }}
      className="mt-1 flex w-full items-start gap-1.5 rounded-r-md border-l-2 border-[#8FA83F]/50 bg-white/[0.03] py-1 pl-2 pr-2 text-left transition-colors hover:bg-white/[0.06]"
      title={t.post.seeOriginal}
    >
      <CornerUpLeft className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-1 text-[11px] text-muted-foreground">
          {t.post.inReplyTo} {label} <span className="font-bold text-foreground/80">@{parent.user.handle}</span>
          {parent.ticker ? (
            <span className="flex items-center gap-1">
              <TokenGlyph src={parent.image} ticker={parent.ticker} size="xs" />
              <span className="font-bold text-primary">{parent.ticker}</span>
            </span>
          ) : (
            /* Call con el CA pegado a mano: no hay token en Cabal, pero al menos se ve de cuál iba. */
            parent.contract && <span className="font-mono font-bold text-primary">{shortWallet(parent.contract)}</span>
          )}
        </span>
        <span className={cn('mt-0.5 block text-[11px] text-muted-foreground/90', compact ? 'line-clamp-1' : 'line-clamp-2')}>
          {parent.content}
        </span>
      </span>
    </button>
  )
}

/** Popup con el gráfico en vivo y la compra/venta de un token (calls del feed e historial del perfil). */
export function TokenChartDialog({
  contract,
  ticker,
  open,
  onOpenChange,
}: {
  contract: string
  /** La red la detecta ContractResult; se mantiene por compatibilidad. */
  network?: string
  ticker?: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96dvh] overflow-y-auto border-white/10 bg-[#121410] p-3 sm:max-w-[96vw] lg:max-w-[1200px]" aria-describedby={undefined}>
        <DialogTitle className="text-sm font-bold">{ticker ? `$${ticker}` : t.post.chartTitle}</DialogTitle>
        {open && <ContractResult ca={contract} chartHeight={600} />}
      </DialogContent>
    </Dialog>
  )
}

function CallChartDialog({ post, open, onOpenChange }: { post: PostDTO; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data } = useCallResult(post.id, open && post.kind === 'call' && !!post.contract && !post.token)
  if (!post.contract || !post.network) return null
  return (
    <TokenChartDialog
      contract={post.contract}
      network={post.network}
      ticker={post.token?.ticker ?? data?.symbol}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

/** Popup con la tarjeta de resultado de una call y el botón para compartirla en X. */
export function CallShareDialog({
  postId,
  handle,
  open,
  onOpenChange,
}: {
  postId: string
  handle: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data } = useCallResult(postId, open)
  const t = useT()
  const cardPath = `/api/posts/${postId}/card`

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
    fetchCardFile(absCardUrl, handle)
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
  const shareText = `${headline} en @cabal_app 🐺`
  // Enlace de invitación de quien comparte (/r/<handle>): quien entre por ahí
  // queda como su referido.
  const { data: me } = useMe()
  const shareUrl = me?.handle ? `https://cabal.army/r/${encodeURIComponent(me.handle)}` : 'https://cabal.army'
  const intentUrl = `https://x.com/intent/post?${new URLSearchParams({ text: shareText, url: shareUrl }).toString()}`

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
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{t.post.shareCallTitle}</DialogTitle>
        <img
          key={cardPath}
          src={cardPath}
          alt={t.post.callResultAlt(symbol)}
          width={1200}
          height={675}
          className="w-full border-b border-white/10"
        />
        <div className="p-4">
          {/* X no adjunta la imagen desde el intent: en escritorio hay que
              copiarla o descargarla y pegarla a mano en el compositor. */}
          {!nativeShare && (
            <p className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
              {t.post.forImage}
              {copyable && (
                <>
                  <button
                    type="button"
                    onClick={copyCard}
                    disabled={!cardFile}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? t.post.copied : t.post.copy}
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
                {t.post.download}
              </button>
              {copyable && <span className="w-full basis-full text-[10.5px] opacity-80">{t.post.pasteHint}</span>}
            </p>
          )}

          {nativeShare && cardFile ? (
            <Button onClick={shareFromDevice} className="w-full gap-2 text-[14px] font-bold">
              <Send className="h-4 w-4" /> {t.post.shareOnX}
            </Button>
          ) : (
            <Button asChild className="w-full gap-2 text-[14px] font-bold">
              <a href={intentUrl} target="_blank" rel="noopener noreferrer">
                <Send className="h-4 w-4" /> {t.post.shareOnX}
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
}: {
  post: PostDTO
  compact?: boolean
}) {
  const t = useT()
  const like = useLikeToggle()
  const follow = useFollowToggle()
  const createPost = useCreatePost()
  const { openLaunch, openToken } = useUI()
  const [shareOpen, setShareOpen] = useState(false)
  const [chartOpen, setChartOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [reply, setReply] = useState('')

  const sendReply = () => {
    if (!reply.trim()) return
    createPost.mutate(
      // parentId: sin esto la respuesta salía en el feed como un comentario
      // suelto, sin rastro de a qué se contestaba.
      { kind: 'comment', content: reply.trim(), launchId: post.launch?.id, tokenId: post.token?.id, parentId: post.id },
      {
        onSuccess: () => {
          setReply('')
          setReplyOpen(false)
        },
      }
    )
  }

  return (
    <article
      data-post-id={post.id}
      className={cn(
        'card-surface scroll-mt-20 rounded-xl border border-white/10 transition-colors hover:border-white/12',
        compact ? 'p-2.5' : 'p-3.5'
      )}
    >
      <div className="flex items-start gap-2.5">
        <Link href={`/u/${post.user.handle}`} className="shrink-0" aria-label={t.post.profileOf(post.user.handle)}>
          <UserAvatar name={post.user.name} handle={post.user.handle} src={post.user.avatar} size={compact ? 'sm' : 'md'} verified={post.user.walletVerified} official={post.user.verified} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link href={`/u/${post.user.handle}`} className="flex min-w-0 items-center gap-x-1.5 hover:underline">
              <span className={cn('truncate font-semibold', compact ? 'text-[13px]' : 'text-sm')}>{post.user.name}</span>
              {post.user.verified && <OfficialBadge />}
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
              <KindBadge kind={post.kind} reply={!!post.parent} />
              <span className="text-[11px] text-muted-foreground">{timeAgo(post.createdAt)}</span>
            </span>
          </div>

          {post.parent && <ParentQuote post={post} parent={post.parent} compact={compact} />}

          <RichText
            text={post.content}
            className={cn(
              'mt-1.5 block whitespace-pre-wrap break-words leading-relaxed text-foreground/90',
              compact ? 'line-clamp-3 text-[13px]' : 'text-sm',
              // Crítica retirada: se queda en el hilo (las respuestas hablan de
              // ella) pero apagada, para que no siga pesando como acusación.
              post.retracted && 'text-muted-foreground line-through decoration-white/25'
            )}
          />

          {post.kind === 'fud' && (
            <p className="mt-1 text-[11px] font-semibold text-amber-200/70">
              {post.retracted
                ? t.post.retracted
                : t.post.fudReason}
            </p>
          )}

          {post.kind === 'call' && post.contract && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
              <CallTokenGlyph post={post} />
              <CopyCA contract={post.contract} className="min-w-0 shrink text-[11px]" />
              <CallResultBadge post={post} />
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {post.network && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Token conocido en Cabal: ficha completa (gráfico, compra y chat).
                      if (post.token) openToken(post.token.id)
                      else setChartOpen(true)
                    }}
                    className="text-muted-foreground hover:text-primary"
                    title={t.post.chartTitle}
                    aria-label={t.post.chartTitle}
                  >
                    <CandlestickChart className="h-3.5 w-3.5" />
                  </button>
                )}
                <CallBuyButton post={post} compact={compact} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShareOpen(true)
                  }}
                  className="text-muted-foreground hover:text-primary"
                  title={t.post.cardTitle}
                  aria-label={t.post.cardAria}
                >
                  <ImageDown className="h-3.5 w-3.5" />
                </button>
              </span>
              <CallChartDialog post={post} open={chartOpen} onOpenChange={setChartOpen} />
              <CallShareDialog postId={post.id} handle={post.user.handle} open={shareOpen} onOpenChange={setShareOpen} />
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
                  <span className="text-amber-300/90">{t.notifications.private}</span>
                ) : (
                  post.launch.ticker
                )}{' '}
                <span className="font-normal text-muted-foreground">{t.post.launch}</span>
              </span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-primary">{t.post.seeInRadar}</span>
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
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-primary">{t.post.seeToken}</span>
            </button>
          )}

          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={() => like.mutate(post.id)}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                post.liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
              )}
              aria-label={t.post.like}
            >
              <Heart className={cn('h-3.5 w-3.5', post.liked && 'fill-primary')} />
              {post.likes}
            </button>
            <button
              onClick={() => setReplyOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                replyOpen ? 'text-primary' : 'text-muted-foreground hover:text-primary'
              )}
              aria-label={t.post.reply}
              aria-expanded={replyOpen}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {t.post.reply}
            </button>
            {typeof post.pnl === 'number' && post.pnl > 0 && (
              <span className="ml-auto flex items-center gap-1 rounded-md bg-[#8FA83F]/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                <TrendingUp className="h-3 w-3" /> +${post.pnl.toLocaleString()}
              </span>
            )}
          </div>

          {replyOpen && (
            <div className="mt-2 flex items-start gap-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t.post.replyPlaceholder(post.user.handle)}
                className="min-h-[42px] flex-1 resize-none rounded-lg border-white/10 bg-white/5 p-2 text-base sm:text-xs"
                aria-label={t.post.replyAria}
                autoFocus
              />
              <Button
                size="sm"
                onClick={sendReply}
                disabled={!reply.trim() || createPost.isPending}
                className="shrink-0 gap-1 px-3 text-[11px] font-bold"
              >
                <Send className="h-3 w-3" /> {t.post.send}
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
