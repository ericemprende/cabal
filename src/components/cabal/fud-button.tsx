'use client'

import { useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { Chapa } from '@/components/cabal/chapa'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useFudRetract, useFudVote } from '@/lib/api-client'
import { FUD_REASON_MAX, FUD_REASON_MIN, fudReasonError } from '@/lib/fud'

/**
 * El "popó": el voto en contra que vive al lado del fueguito.
 *
 * No se puede pulsar y ya: abre un diálogo que pide el motivo, y ese motivo se
 * publica como comentario firmado en el hilo del proyecto. Así nadie tira
 * mierda a un proyecto sin dar la cara ni decir qué vio, y el dev tiene dónde
 * responder. Si le convencen, el mismo botón sirve para retractarse.
 */
export function FudButton({
  launchId,
  fud,
  fudded,
  size = 'sm',
  className,
}: {
  launchId: string
  fud: number
  fudded: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const vote = useFudVote()
  const retract = useFudRetract()

  const error = fudReasonError(reason)
  const busy = vote.isPending || retract.isPending

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          'flex items-center gap-1.5 rounded-full border font-bold transition-all active:scale-95',
          size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs',
          fudded
            ? 'border-amber-700/60 bg-amber-900/25 text-amber-200'
            : 'border-white/10 text-muted-foreground hover:border-amber-700/50 hover:text-amber-200',
          className
        )}
        title={fudded ? t.fud.votedTitle : t.fud.voteTitle}
        aria-label={fudded ? t.fud.removeAria : t.fud.voteAria}
      >
        <span className={cn('leading-none', size === 'md' ? 'text-base' : 'text-[13px]')} aria-hidden>
          💩
        </span>
        {fud}
      </button>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent
          className="border-white/10 bg-[#121410] sm:max-w-md"
          onClick={(e) => e.stopPropagation()}
          aria-describedby={undefined}
        >
          <DialogTitle className="flex items-center gap-2 text-base">
            <span aria-hidden>💩</span>
            {fudded ? t.fud.already : t.fud.why}
          </DialogTitle>

          {fudded ? (
            <>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {t.fud.alreadyBody}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                  {t.fud.keepVote}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    retract.mutate(launchId, {
                      onSuccess: () => {
                        setOpen(false)
                        setReason('')
                      },
                    })
                  }
                >
                  {retract.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {t.fud.retract}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {t.fud.reasonBody}
              </p>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={FUD_REASON_MAX}
                rows={4}
                autoFocus
                placeholder={t.fud.reasonPlaceholder}
                className="resize-none bg-[#0a0b08] text-base sm:text-[13px]"
              />
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Chapa silueta="turd" metal={fudded ? 'bronce' : 'acero'} className="h-5 w-5" placa />
                <span className="min-w-0 flex-1">{error ?? t.fud.publicNote}</span>
                <span className="shrink-0 tabular-nums">
                  {reason.trim().length}/{FUD_REASON_MIN}
                </span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                  Cancelar
                </Button>
                <Button
                  disabled={busy || Boolean(error)}
                  onClick={() =>
                    vote.mutate(
                      { launchId, reason: reason.trim() },
                      {
                        onSuccess: () => {
                          setOpen(false)
                          setReason('')
                        },
                      }
                    )
                  }
                >
                  {vote.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                  Publicar y votar en contra
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
