'use client'

import { useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
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
        title={fudded ? 'Votaste en contra: pulsa para ver tu motivo o retractarte' : 'Votar en contra (hay que explicar por qué)'}
        aria-label={fudded ? 'Retirar tu voto en contra' : 'Votar en contra de este proyecto'}
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
            {fudded ? 'Ya votaste en contra' : '¿Por qué es un mal proyecto?'}
          </DialogTitle>

          {fudded ? (
            <>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Tu motivo está publicado en los comentarios del proyecto, con tu nombre. Si te responden y te convencen
                de que estabas equivocado, puedes retractarte: el voto deja de contar y tu comentario se queda marcado
                como retractado, para que el hilo siga teniendo sentido.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                  Mantener mi voto
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
                  Me retracto
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                El popó solo cuenta con una razón detrás. Escribe qué viste —el equipo, el contrato, la distribución, lo
                que sea— y se publicará como comentario tuyo en el hilo del proyecto, donde te podrán responder.
              </p>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={FUD_REASON_MAX}
                rows={4}
                autoFocus
                placeholder="Ej: el dev tiene el 40% del supply en una wallet y ya rugueó otro token en agosto…"
                className="resize-none bg-[#0a0b08] text-base sm:text-[13px]"
              />
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">{error ?? 'Se publicará como comentario público, firmado por ti'}</span>
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
