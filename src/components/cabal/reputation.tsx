'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, Crown, MessageSquareText, ShieldQuestion, ThumbsDown, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/cabal'
import { UserAvatar } from '@/components/cabal/shared'
import { REP_BODY_MAX, REP_MIN_VOTES, REP_TONE_CLASS, repLabel } from '@/lib/reputation'
import { useRateUser, useSession, useUserReputation } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import type { ReputationReviewDTO, ReputationSummaryDTO } from '@/lib/types'

/**
 * Insignia compacta de confianza. Se pinta donde aparece una persona y hay que
 * decidir si fiarse de ella (el dev de un launch, sobre todo). El fueguito
 * mide el proyecto; esto mide a quien lo publica.
 */
export function TrustBadge({
  rep,
  handle,
  className,
}: {
  rep: ReputationSummaryDTO
  /** Si se pasa, la insignia lleva al perfil, que abre el pop-up de reputación. */
  handle?: string
  className?: string
}) {
  const label = repLabel(rep.score, rep.votes)
  const tone = REP_TONE_CLASS[label.tone]
  const enough = rep.votes >= REP_MIN_VOTES

  const content = (
    <>
      {enough ? (
        <ThumbsUp
          className={cn('h-3 w-3', (label.tone === 'bad' || label.tone === 'poor') && 'rotate-180')}
          aria-hidden
        />
      ) : (
        <ShieldQuestion className="h-3 w-3" aria-hidden />
      )}
      {enough ? (
        <>
          <span className="tabular-nums">{rep.score}%</span>
          <span className="font-semibold opacity-80">{label.text}</span>
        </>
      ) : (
        <span className="font-semibold">Sin valoraciones</span>
      )}
    </>
  )

  const classes = cn(
    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold',
    tone.text,
    tone.bg,
    tone.border,
    className
  )

  if (!handle) {
    return (
      <span className={classes} title={label.hint}>
        {content}
      </span>
    )
  }
  return (
    <Link
      href={`/u/${handle}#reputacion`}
      className={cn(classes, 'transition-opacity hover:opacity-80')}
      title={label.hint}
    >
      {content}
    </Link>
  )
}

/**
 * Reputación en la cabecera del perfil: los botones Confío / No confío con sus
 * contadores, y un pop-up con el marcador, la reseña propia y las de la
 * comunidad. Votar abre el pop-up para escribir la reseña (opcional).
 *
 * `open` / `onOpenChange` dejan que la cabecera abra el pop-up desde la
 * insignia de confianza o desde un enlace /u/x#reputacion.
 */
export function ReputationActions({
  handle,
  name,
  open,
  onOpenChange,
}: {
  handle: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data } = useUserReputation(handle)
  const rate = useRateUser(handle)
  const { openAuth, setPremiumOpen } = useUI()
  const { data: session } = useSession()
  const [draft, setDraft] = useState('')

  const summary = data?.summary ?? { score: 50, up: 0, down: 0, votes: 0 }
  const mine = data?.mine ?? null
  const self = data?.reason === 'self'
  // Valorar es un perk Premium: sin plan se enseña la puerta, no un error
  const needsPremium = data?.reason === 'premium'

  const goPremium = () => {
    onOpenChange(false)
    setPremiumOpen(true)
  }

  // El borrador se rellena al abrir, no en un efecto: así editar una reseña ya
  // escrita arranca con su texto y nada pisa lo que se teclea mientras la
  // consulta se revalida de fondo.
  const openDialog = (body = mine?.body ?? '') => {
    setDraft(body)
    onOpenChange(true)
  }

  const vote = (value: 1 | -1) => {
    // Sin sesión no se vota: se pide entrar en vez de fallar contra la API
    if (!session?.loggedIn) return openAuth('login')
    // Pulsar el voto que ya tenías lo retira: el mismo botón es el interruptor.
    const next = mine?.value === value ? 0 : value
    // Retirar lo que ya votaste no pide nada: quien deja de ser Premium no se
    // queda atrapado con una valoración que ya no sostiene.
    if (next !== 0 && !data?.canVote) {
      if (needsPremium) return goPremium()
      toast.error(self ? 'No puedes valorarte a ti mismo' : 'Verifica tu correo, tu X o tu wallet para poder valorar')
      return
    }
    rate.mutate(
      { value: next, body: next === 0 ? '' : mine?.body ?? '' },
      {
        onSuccess: (res) => {
          if (next === 0) toast.success('Valoración retirada')
          // Tras votar, el pop-up invita a contar por qué
          else if (!open) openDialog(res.mine?.body ?? '')
        },
      }
    )
  }

  const saveReview = () => {
    if (!mine) return
    rate.mutate(
      { value: mine.value, body: draft.trim() },
      {
        onSuccess: () => {
          toast.success(draft.trim() ? 'Reseña publicada' : 'Reseña borrada')
          onOpenChange(false)
        },
      }
    )
  }

  const reviewsCount = (data?.reviews.length ?? 0) + (data?.more ?? 0)

  return (
    <>
      <div className="flex items-center gap-1.5">
        {!self && (
          <>
            <VoteButton kind="up" count={summary.up} active={mine?.value === 1} disabled={rate.isPending} onClick={() => vote(1)} />
            <VoteButton kind="down" count={summary.down} active={mine?.value === -1} disabled={rate.isPending} onClick={() => vote(-1)} />
          </>
        )}
        <button
          type="button"
          onClick={() => openDialog()}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
        >
          <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
          Reseñas{reviewsCount > 0 && <span className="tabular-nums">{reviewsCount}</span>}
        </button>
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto border-white/10 bg-[#0d0e0a] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 font-display text-base">
              <ThumbsUp className="h-4 w-4 text-primary" aria-hidden /> Reputación de {name}
            </DialogTitle>
            <DialogDescription className="text-[11px]">Qué opina el Cabal de esta persona, no de sus proyectos</DialogDescription>
          </DialogHeader>

          <Scoreboard summary={summary} loading={!data} />

          {/* Voto y reseña de quien mira. A uno mismo no se le enseñan. */}
          {!self && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <VoteButton kind="up" wide active={mine?.value === 1} disabled={rate.isPending} onClick={() => vote(1)} />
                <VoteButton kind="down" wide active={mine?.value === -1} disabled={rate.isPending} onClick={() => vote(-1)} />
              </div>

              {needsPremium && <PremiumGate hasVote={Boolean(mine)} onOpen={goPremium} />}

              {data?.reason === 'unverified' && (
                <p className="text-[11px] text-amber-300/90">Verifica tu correo, tu X o tu wallet en tu perfil para poder valorar.</p>
              )}

              {mine && data?.canVote ? (
                <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, REP_BODY_MAX))}
                    placeholder={`¿Por qué ${mine.value === 1 ? 'confías' : 'no confías'} en ${name}? Cuenta tu experiencia (opcional).`}
                    className="min-h-[72px] resize-none border-white/10 bg-transparent text-sm"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {draft.length}/{REP_BODY_MAX}
                    </span>
                    <Button
                      size="sm"
                      className="ml-auto h-8 text-xs font-bold"
                      onClick={saveReview}
                      disabled={rate.isPending || draft.trim() === mine.body}
                    >
                      {mine.body ? 'Guardar reseña' : 'Publicar reseña'}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">Pulsa de nuevo tu voto para retirarlo.</p>
                </div>
              ) : (
                data?.canVote && <p className="text-[11px] text-muted-foreground">Vota para poder dejar una reseña.</p>
              )}
            </div>
          )}

          {/* Reseñas de la comunidad */}
          {!data ? (
            <div className="space-y-1.5">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-[#0a0b08]" />
              ))}
            </div>
          ) : data.reviews.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Reseñas</p>
              {data.reviews.map((r) => (
                <ReviewRow key={r.id} review={r} />
              ))}
              {data.more > 0 && (
                <p className="pt-1 text-center text-[11px] text-muted-foreground">
                  y {data.more} {data.more === 1 ? 'reseña más' : 'reseñas más'}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-muted-foreground">
              Todavía no hay reseñas escritas.{!self && data.canVote && ' Sé el primero en contar tu experiencia.'}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Puerta del perk: valorar a una persona (👍/👎 y reseña) es de Premium. Se
 * enseña en vez de esconder los botones, que es lo que explica por qué el voto
 * no entra y dónde se consigue.
 */
function PremiumGate({ hasVote, onOpen }: { hasVote: boolean; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
      <Crown className="h-4 w-4 shrink-0 fill-amber-300 text-amber-300" aria-hidden />
      <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-foreground/85">
        Valorar a otras personas y dejar reseñas es parte de <strong className="font-bold text-amber-300">Cabal Premium</strong>.
        {hasVote && ' Tu valoración sigue publicada: pulsa tu voto para retirarla.'}
      </p>
      <Button
        size="sm"
        onClick={onOpen}
        className="h-8 rounded-lg bg-amber-400 px-3 text-xs font-bold text-[#171200] hover:bg-amber-300"
      >
        Hazte Premium
      </Button>
    </div>
  )
}

function Scoreboard({ summary, loading }: { summary: ReputationSummaryDTO; loading: boolean }) {
  const label = repLabel(summary.score, summary.votes)
  const tone = REP_TONE_CLASS[label.tone]
  const enough = summary.votes >= REP_MIN_VOTES
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded bg-white/5" />
        ) : enough ? (
          <p className={cn('font-display text-3xl font-black leading-none tabular-nums', tone.text)}>{summary.score}%</p>
        ) : (
          <p className="font-display text-xl font-bold leading-none text-muted-foreground">Sin reputación</p>
        )}
        {enough && <p className={cn('text-sm font-bold', tone.text)}>{label.text}</p>}
        <p className="ml-auto text-[11px] text-muted-foreground">
          {summary.votes === 0
            ? 'Nadie la ha valorado todavía'
            : `${summary.votes.toLocaleString('es')} ${summary.votes === 1 ? 'valoración' : 'valoraciones'}`}
        </p>
      </div>

      {/* Barra: proporción real de 👍 sobre el total, sin suavizar, para que
          lo que se ve encaje con los dos contadores de abajo. */}
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={cn('h-full rounded-full transition-all', tone.bar)}
          style={{ width: `${summary.votes ? (100 * summary.up) / summary.votes : 0}%` }}
        />
      </div>

      <div className="mt-2.5 flex items-center gap-4 text-[12px] font-semibold">
        <span className="flex items-center gap-1.5 text-primary">
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> {summary.up.toLocaleString('es')}
        </span>
        <span className="flex items-center gap-1.5 text-[#ff8080]">
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden /> {summary.down.toLocaleString('es')}
        </span>
        {!enough && summary.votes > 0 && (
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">
            Faltan {REP_MIN_VOTES - summary.votes} para el porcentaje
          </span>
        )}
      </div>
    </div>
  )
}

function VoteButton({
  kind,
  active,
  disabled,
  onClick,
  count,
  wide = false,
}: {
  kind: 'up' | 'down'
  active: boolean
  disabled: boolean
  onClick: () => void
  /** Versión compacta de la cabecera: enseña el contador en vez del texto largo. */
  count?: number
  wide?: boolean
}) {
  const Icon = kind === 'up' ? ThumbsUp : ThumbsDown
  const text = kind === 'up' ? 'Confío' : 'No confío'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={count !== undefined ? `${text} (${count})` : undefined}
      title={text}
      className={cn(
        'flex items-center justify-center gap-1.5 border font-bold transition-all active:scale-95 disabled:opacity-50',
        wide ? 'rounded-xl px-3 py-2.5 text-sm' : 'h-8 rounded-lg px-2.5 text-[12px]',
        active
          ? kind === 'up'
            ? 'neon-shadow border-[#8FA83F]/50 bg-[#8FA83F]/15 text-primary'
            : 'border-[#ff8080]/50 bg-[#ff8080]/15 text-[#ff8080]'
          : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
      )}
    >
      <Icon className={cn(wide ? 'h-4 w-4' : 'h-3.5 w-3.5', active && 'fill-current')} aria-hidden />
      {wide ? text : <span className="tabular-nums">{count ?? 0}</span>}
    </button>
  )
}

function ReviewRow({ review }: { review: ReputationReviewDTO }) {
  const up = review.value === 1
  return (
    <article className="flex gap-2.5 rounded-xl border border-white/8 bg-[#0a0b08] p-3">
      <Link href={`/u/${review.author.handle}`} aria-label={`Perfil de @${review.author.handle}`}>
        <UserAvatar
          name={review.author.name}
          handle={review.author.handle}
          src={review.author.avatar}
          size="sm"
          verified={review.author.walletVerified}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 text-[12px]">
          <Link href={`/u/${review.author.handle}`} className="font-semibold hover:underline">
            {review.author.name}
          </Link>
          {review.author.xVerified && <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label="Verificado con X" />}
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              up ? 'bg-[#8FA83F]/15 text-primary' : 'bg-[#ff8080]/15 text-[#ff8080]'
            )}
          >
            {up ? <ThumbsUp className="h-2.5 w-2.5" aria-hidden /> : <ThumbsDown className="h-2.5 w-2.5" aria-hidden />}
            {up ? 'Confía' : 'No confía'}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {timeAgo(review.createdAt)}
            {review.edited ? ' · editada' : ''}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed">{review.body}</p>
      </div>
    </article>
  )
}
