'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, HandHeart, Languages, Loader2, Send, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { jsonFetch, qk } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { fmtUsd, type DonationDTO } from '@/lib/donate'
import type { Locale } from '@/lib/share-card'

/**
 * Pantalla de gracias de una donación: el recibo, los puntos y la tarjeta para
 * publicar en X que se ha apoyado el proyecto.
 *
 * Se abre al volver del pago (/app?donated=<id>), en cuanto se abre la factura
 * en la otra pestaña, y también desde el diálogo de donar si quedó un bonus por
 * compartir sin cobrar.
 *
 * En cripto la confirmación tarda: mientras el pago no está confirmado se
 * consulta el estado cada pocos segundos. La tarjeta se puede publicar ya —el
 * bonus se abona cuando llega el dinero, y si se compartió antes se cobra solo
 * en cuanto la red confirma.
 */
export function DonateThanksDialog() {
  const { donateThanksId, setDonateThanksId } = useUI()
  const qc = useQueryClient()
  const id = donateThanksId
  const [pickedLocale, setLocale] = useState<Locale | null>(null)
  /** Ya abrió X: si el pago aún no estaba confirmado, el bonus se cobra al confirmarse. */
  const shareOpened = useRef(false)

  const donation = useQuery<DonationDTO>({
    queryKey: ['donation', id],
    queryFn: () => jsonFetch(`/api/donate/${id}`),
    enabled: Boolean(id),
    // Mientras no esté confirmada, se pregunta cada 8 s; después se deja en paz.
    refetchInterval: (q) => (q.state.data?.confirmed ? false : 8_000),
  })

  const data = donation.data

  const claim = useMutation({
    mutationFn: () =>
      jsonFetch<{ ok: boolean; pending: boolean; pointsEarned: number; shared: boolean }>(
        `/api/donate/${id}`,
        { method: 'POST' }
      ),
    onSuccess: (res) => {
      if (res.pointsEarned > 0) {
        toast.success(`+${res.pointsEarned} puntos Cabal`, {
          description: 'Gracias por contarlo: así llega a más gente',
        })
      }
      qc.invalidateQueries({ queryKey: ['donation', id] })
      qc.invalidateQueries({ queryKey: ['donate', 'config'] })
      qc.invalidateQueries({ queryKey: qk.me })
      qc.invalidateQueries({ queryKey: qk.points })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Compartió con el pago aún en el aire: el bonus se cobra solo en cuanto la
  // red confirma, sin obligar a volver a pulsar el botón.
  useEffect(() => {
    if (!data?.confirmed || data.shared) return
    if (!shareOpened.current || claim.isPending) return
    claim.mutate()
  }, [data?.confirmed, data?.shared])

  // Los puntos de la donación entran por el webhook: cuando se confirma, el
  // balance de la interfaz ya no vale.
  useEffect(() => {
    if (!data?.confirmed) return
    qc.invalidateQueries({ queryKey: qk.me })
    qc.invalidateQueries({ queryKey: qk.points })
  }, [data?.confirmed])

  const locale = pickedLocale ?? data?.locale ?? 'es'
  const other: Locale = locale === 'es' ? 'en' : 'es'
  const post = data?.share[locale]

  return (
    <Dialog open={Boolean(id)} onOpenChange={(v) => !v && setDonateThanksId(null)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-primary/25 bg-[#121410] sm:max-w-md">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <HandHeart className="h-5 w-5 text-primary" aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-xl font-bold">Gracias, de verdad</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {data ? `Tu donación de ${fmtUsd(data.amountUsd)} mantiene esto en pie` : 'Un segundo…'}
            </DialogDescription>
          </div>
        </div>

        {!data || !post ? (
          <Skeleton className="h-[360px] w-full rounded-xl" />
        ) : (
          <>
            {/* Estado del pago y puntos */}
            <div
              className={cnStatus(data.confirmed)}
            >
              {data.confirmed ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              ) : (
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-300" aria-hidden />
              )}
              <div className="min-w-0">
                <p className={`text-[14px] font-bold ${data.confirmed ? 'text-primary' : 'text-amber-300'}`}>
                  {data.confirmed
                    ? `+${data.points.toLocaleString('es')} puntos Cabal abonados`
                    : 'Esperando la confirmación de la red'}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                  {data.confirmed ? (
                    <>
                      Ya están en tu balance, y con ellos subes en la tabla de líderes. Los puntos se
                      canjean por $CABAL.
                    </>
                  ) : (
                    <>
                      En cripto puede tardar unos minutos. Cuando entre, se te abonan{' '}
                      <span className="font-mono font-bold text-amber-300">
                        +{data.points.toLocaleString('es')}
                      </span>{' '}
                      puntos sin que tengas que hacer nada.
                      {data.invoiceUrl && (
                        <>
                          {' '}
                          <a
                            href={data.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Abrir la factura
                          </a>{' '}
                          si la cerraste sin pagar.
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Tarjeta para X */}
            {data.shared ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.07] p-3.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="text-[13px] leading-relaxed text-foreground/90">
                  Tarjeta compartida y bonus de{' '}
                  <span className="font-mono font-bold text-primary">+{data.shareBonus}</span> puntos
                  cobrado. 🫡
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-xl border border-[#8FA83F]/40 bg-[#8FA83F]/10 p-3.5">
                  <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-[14px] font-bold text-primary">
                      Cuéntalo y suma {data.shareBonus} puntos más
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                      Tu tarjeta dice que apoyas el proyecto, no cuánto donaste. Es lo que hace que
                      llegue gente nueva al radar.
                    </p>
                  </div>
                </div>

                {/* Vista previa: lo mismo que verá X al publicarlo. */}
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0b08]">
                  <div className="p-3.5 pb-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Tu post
                      </p>
                      <button
                        type="button"
                        onClick={() => setLocale(other)}
                        className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        <Languages className="h-3 w-3" aria-hidden />
                        {other === 'en' ? 'English' : 'Español'}
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed">{post.text}</p>
                    <p className="mt-1.5 truncate text-[12.5px] text-primary">{post.url}</p>
                  </div>
                  <img
                    key={post.card}
                    src={post.card}
                    alt={`Tarjeta de @${data.handle} para compartir en X`}
                    width={1672}
                    height={941}
                    className="w-full border-t border-white/10"
                  />
                </div>

                <Button
                  asChild
                  onClick={() => {
                    shareOpened.current = true
                    claim.mutate()
                  }}
                  className="w-full gap-2 text-[15px] font-bold"
                >
                  <a href={post.intent} target="_blank" rel="noopener noreferrer">
                    <Send className="h-4 w-4" aria-hidden /> Compartir en X
                    <span className="font-mono">+{data.shareBonus}</span>
                  </a>
                </Button>
                {!data.confirmed && (
                  <p className="text-center text-[11px] leading-relaxed text-muted-foreground/80">
                    Puedes publicarla ya: el bonus se abona en cuanto el pago se confirme.
                  </p>
                )}
              </>
            )}
          </>
        )}

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => setDonateThanksId(null)}
        >
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  )
}

/** Marco del bloque de estado: verde cuando está confirmado, ámbar mientras espera. */
function cnStatus(confirmed: boolean): string {
  return confirmed
    ? 'flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/[0.08] p-3.5'
    : 'flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-3.5'
}
