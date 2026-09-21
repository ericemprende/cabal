'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { HandHeart, ShieldCheck, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUI } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Donaciones en cripto con el widget embebido de NOWPayments. La key del
 * widget es pública por diseño (va en el src del iframe, a la vista de
 * cualquiera); se deja en una variable de entorno solo para poder rotarla sin
 * tocar el código.
 */
const API_KEY = process.env.NEXT_PUBLIC_NOWPAYMENTS_DONATION_KEY || 'fc1b8492-4709-4e61-ba59-9a241322ffa0'
const WIDGET_URL = `https://nowpayments.io/embeds/donation-widget?api_key=${API_KEY}`

/** Medidas fijas del embed: no es responsive, lo escalamos nosotros. */
const WIDGET_W = 346
const WIDGET_H = 623

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
      variant="ghost"
      size="sm"
      onClick={() => {
        markSeen()
        setDonateOpen(true)
      }}
      title="Donar a Cabal"
      className={cn(
        'animate-donate-glow h-9 gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 text-[13px] font-bold text-white hover:bg-white/20 hover:text-white sm:px-3',
        className
      )}
    >
      <HandHeart className="animate-donate-wiggle h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Donar</span>
      <span className="sr-only sm:hidden">Donar</span>
    </Button>
  )
}

/**
 * El diálogo con el widget. Se abre desde el botón de la cabecera y, solo, una
 * vez cada 24 h: nunca en la primera visita (esa se limita a arrancar el
 * contador) ni mientras haya otro diálogo abierto.
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
        !!s.launchDetailId || !!s.tokenDetailId
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-white/15 bg-[#121410] p-0 sm:max-w-md">
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
              <span className="font-bold text-white">Con 1 USDT ya estás aportando.</span> No hay
              mínimo ni cantidad pequeña: aquí suma más que mucha gente done poco a que poca gente
              done mucho.
            </span>
          </p>
        </div>

        <div className="px-3 pb-3 pt-4">
          <DonationWidget />
        </div>

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
            Pagos procesados por NOWPayments · BTC, ETH, SOL, USDT y +300 criptos
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

/** El embed mide 346×623 fijos: lo encogemos si la pantalla no da para tanto. */
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
    <div ref={box} className="w-full" style={{ height: WIDGET_H * scale }}>
      <iframe
        src={WIDGET_URL}
        title="Donar a Cabal con cripto"
        width={WIDGET_W}
        height={WIDGET_H}
        loading="lazy"
        scrolling="no"
        className="mx-auto block overflow-hidden rounded-xl border-0"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
      >
        No se pudo cargar el widget de donaciones.
      </iframe>
    </div>
  )
}
