'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, HandHeart, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUI } from '@/lib/store'
import { jsonFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { fmtUsd, type DonateConfigDTO } from '@/lib/donate'

/**
 * Donaciones en cripto con el widget embebido de NOWPayments: el importe y la
 * moneda se eligen dentro del propio widget, que es lo que funciona sin
 * sorpresas. La factura propia (con puntos Cabal) dio problemas y está fuera;
 * lo que sí se conserva es el aviso de una donación anterior que dejó pendiente
 * la tarjeta para X.
 *
 * La key del widget es pública por diseño (va en el src del iframe, a la vista
 * de cualquiera); se deja en una variable de entorno solo para poder rotarla sin
 * tocar el código.
 */
const API_KEY = process.env.NEXT_PUBLIC_NOWPAYMENTS_DONATION_KEY || 'fc1b8492-4709-4e61-ba59-9a241322ffa0'
const WIDGET_URL = `https://nowpayments.io/embeds/donation-widget?api_key=${API_KEY}`

/** Página de donación a pantalla completa: la salida si el embed se atasca. */
const PAGE_URL = `https://nowpayments.io/donation?api_key=${API_KEY}`

/**
 * El embed mide 346 de ancho fijo (no es responsive, lo escalamos nosotros).
 * De alto, los 623 del snippet oficial solo valen para el primer paso: el de la
 * dirección y el QR es bastante más alto, y con una altura corta y sin scroll el
 * botón de continuar queda recortado y parece que el widget se ha colgado.
 */
const WIDGET_W = 346
const WIDGET_H = 780

/** Cuándo se vio el pop-up por última vez (ms). */
const SEEN_KEY = 'cabal:donate:seen'
const EVERY_MS = 24 * 3600_000
/** Margen para que no salte encima de quien acaba de entrar. */
const DELAY_MS = 25_000

function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()))
  } catch {
    /* modo privado o storage bloqueado: solo se pierde el recordatorio */
  }
}

/**
 * Botón de donar de la cabecera: en blanco, con un halo que respira y una
 * sacudida cada pocos segundos para que se note sin gritar.
 */
export function DonateButton({ className }: { className?: string }) {
  const setDonateOpen = useUI((s) => s.setDonateOpen)
  return (
    <Button
      variant="donar"
      size="sm"
      onClick={() => {
        markSeen()
        setDonateOpen(true)
      }}
      title="Donar a Cabal"
      className={cn('animate-donate-glow gap-1.5 px-2.5 text-[13px] sm:px-3', className)}
    >
      <HandHeart className="animate-donate-wiggle h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Donar</span>
      <span className="sr-only sm:hidden">Donar</span>
    </Button>
  )
}

/**
 * El diálogo. Se abre desde el botón de la cabecera y, solo, una vez cada 24 h:
 * nunca en la primera visita (esa se limita a arrancar el contador) ni mientras
 * haya otro diálogo abierto.
 */
export function DonateDialog() {
  const { donateOpen, setDonateOpen } = useUI()

  useEffect(() => {
    const seen = readSeen()
    // Primera visita: guardamos la marca y no molestamos.
    if (seen === null) {
      markSeen()
      return
    }
    if (Date.now() - seen < EVERY_MS) return

    const t = setTimeout(() => {
      const s = useUI.getState()
      const busy =
        s.authOpen || s.premiumOpen || s.ammoOpen || s.profileOpen || s.adminOpen ||
        s.searchOpen || s.affiliatesOpen || s.composerOpen || s.welcomeShareOpen ||
        s.guideOpen || !!s.donateThanksId || !!s.launchDetailId || !!s.tokenDetailId
      // Si está ocupado no insistimos ahora: sin marca, vuelve a intentarlo al entrar de nuevo.
      if (busy) return
      markSeen()
      s.setDonateOpen(true)
    }, DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <Dialog
      open={donateOpen}
      onOpenChange={(v) => {
        if (!v) markSeen()
        setDonateOpen(v)
      }}
    >
      {/* El widget vive en un iframe ajeno: si el diálogo le roba el foco (al
          abrirse o al detectar foco "fuera" del content), sus campos dejan de
          responder y parece colgado. */}
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        className="max-h-[92dvh] overflow-y-auto border-white/15 bg-[#121410] p-0 sm:max-w-md"
      >
        <div className="relative overflow-hidden border-b border-white/10 p-5">
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10">
              <HandHeart className="h-5 w-5 text-white" aria-hidden />
            </span>
            <div>
              <DialogTitle className="font-display text-lg font-bold">Apoya a Cabal</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Servidores, datos en vivo y desarrollo: esto lo sostiene la comunidad
              </DialogDescription>
            </div>
          </div>
          <p className="relative mt-3 text-[13px] leading-relaxed text-foreground/85">
            Cabal es gratis, sin anuncios y sin vender tus datos. Lo que ves aquí —el radar, los
            datos en vivo, el chat— sale del bolsillo de quien lo construye y de gente como tú.
            Si esta plataforma te ha ahorrado un mal trade o te ha puesto delante de uno bueno,
            contribuir es la forma de mantenerla en pie.
          </p>
          <p className="relative mt-3 flex items-start gap-2 rounded-xl border border-white/20 bg-white/[0.06] p-3 text-[13px] leading-relaxed text-foreground/90">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden />
            <span>
              <span className="font-bold text-white">Con $1 en SOL ya estás aportando.</span> No hay
              mínimo ni cantidad pequeña: aquí suma más que mucha gente done poco a que poca gente
              done mucho.
            </span>
          </p>
        </div>

        <DonateBody open={donateOpen} />

        <div className="mx-3 mb-1 flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.07] p-3.5">
          <HandHeart className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-[13px] leading-relaxed text-foreground/90">
            <span className="font-bold text-primary">Gracias de verdad.</span> Tanto si donas como
            si no, gracias por estar aquí y por hacer que esto valga la pena. Cada aporte se va
            entero a mantener Cabal viva y creciendo para toda la comunidad. 🫡
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 p-4 pt-3">
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
            Pagos procesados por NOWPayments · SOL, USDT, BTC, ETH y +300 criptos
          </p>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => {
              markSeen()
              setDonateOpen(false)
            }}
          >
            Ahora no
          </Button>
          <p className="text-center text-[11px] text-muted-foreground/70">
            No te lo volvemos a preguntar hasta dentro de 24 h.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** El cuerpo: el aviso de lo que quedó a medias, y el widget de siempre. */
function DonateBody({ open }: { open: boolean }) {
  const cfg = useQuery<DonateConfigDTO>({
    queryKey: ['donate', 'config'],
    queryFn: () => jsonFetch('/api/donate'),
    enabled: open,
  })

  return (
    <div className="px-3 pb-3 pt-4">
      {cfg.data?.last && <PendingDonation last={cfg.data.last} />}
      <DonationWidget />
    </div>
  )
}

/** Aviso de la última donación que dejó algo a medias: confirmarse o compartirse. */
function PendingDonation({ last }: { last: NonNullable<DonateConfigDTO['last']> }) {
  const setDonateThanksId = useUI((s) => s.setDonateThanksId)
  const setDonateOpen = useUI((s) => s.setDonateOpen)
  if (last.shared) return null

  return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/[0.08] p-3.5">
      <Send className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-primary">
          {last.confirmed
            ? `Tu donación de ${fmtUsd(last.amountUsd)} ya está confirmada`
            : `Tu donación de ${fmtUsd(last.amountUsd)} se está confirmando`}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {last.confirmed
            ? `Te quedan +${last.shareBonus} puntos por publicar tu tarjeta en X.`
            : 'En cuanto la red confirme, se abonan tus puntos.'}
        </p>
        <Button
          size="sm"
          onClick={() => {
            setDonateOpen(false)
            setDonateThanksId(last.id)
          }}
          className="mt-2 gap-1.5 text-[12.5px] font-bold"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          {last.confirmed ? `Compartir +${last.shareBonus}` : 'Ver estado'}
        </Button>
      </div>
    </div>
  )
}

/**
 * El embed mide 346 de ancho fijo: lo encogemos si la pantalla no da para tanto.
 * El iframe conserva su propio scroll (nada de `scrolling="no"`) para que ningún
 * paso del widget quede fuera de alcance.
 */
function DonationWidget() {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const fit = useCallback(() => {
    const el = box.current
    if (!el) return
    setScale(Math.min(1, el.clientWidth / WIDGET_W))
  }, [])

  useEffect(() => {
    fit()
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  return (
    <div className="w-full">
      <div ref={box} className="w-full" style={{ height: WIDGET_H * scale }}>
        <iframe
          src={WIDGET_URL}
          title="Donar a Cabal con cripto"
          width={WIDGET_W}
          height={WIDGET_H}
          loading="lazy"
          className="mx-auto block rounded-xl border-0"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
        >
          No se pudo cargar el widget de donaciones.
        </iframe>
      </div>
      <a
        href={PAGE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-muted-foreground/80 underline-offset-2 hover:text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ¿Se te queda atascado? Abre la donación en una pestaña
      </a>
    </div>
  )
}
