'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, HandHeart, Send, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUI } from '@/lib/store'
import { jsonFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { purchasesAllowed } from '@/lib/native-app'
import { usePurchasesAllowed } from '@/lib/use-purchases-allowed'
import { useT } from '@/lib/i18n/provider'
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

/** Medidas del embed: no es responsive, lo escalamos nosotros. */
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
  const t = useT()
  const setDonateOpen = useUI((s) => s.setDonateOpen)
  const allowed = usePurchasesAllowed()
  // App Store 3.2.2: solo las ONG aprobadas pueden pedir donaciones en iOS.
  if (!allowed) return null
  return (
    <Button
      variant="donar"
      size="sm"
      onClick={() => {
        markSeen()
        setDonateOpen(true)
      }}
      title={t.donate.title}
      className={cn('animate-donate-glow gap-1.5 px-2.5 text-[13px] sm:px-3', className)}
    >
      <HandHeart className="animate-donate-wiggle h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{t.donate.button}</span>
      <span className="sr-only sm:hidden">{t.donate.button}</span>
    </Button>
  )
}

/**
 * El diálogo. Se abre desde el botón de la cabecera y, solo, una vez cada 24 h:
 * nunca en la primera visita (esa se limita a arrancar el contador) ni mientras
 * haya otro diálogo abierto.
 */
export function DonateDialog() {
  const t = useT()
  const { donateOpen, setDonateOpen } = useUI()
  const allowed = usePurchasesAllowed()

  useEffect(() => {
    if (!purchasesAllowed()) return
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

  if (!allowed) return null
  return (
    /* El diálogo tiene que caber en pantalla: si el botón «Continue» del widget
       queda por debajo del borde de la ventana y hay que arrastrar para llegar,
       el clic se pierde (al iframe solo le llega un `blur`) y parece colgado.
       Por eso todo lo de alrededor del widget es corto. */
    <Dialog
      open={donateOpen}
      onOpenChange={(v) => {
        if (!v) markSeen()
        setDonateOpen(v)
      }}
    >
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        className="max-h-[92dvh] overflow-y-auto border-white/15 bg-[#121410] p-0 sm:max-w-md"
      >
        <div className="relative overflow-hidden border-b border-white/10 px-5 py-4">
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10">
              <HandHeart className="h-4.5 w-4.5 text-white" aria-hidden />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-display text-lg font-bold">{t.donate.title}</DialogTitle>
              <DialogDescription className="text-xs leading-snug text-muted-foreground">
                {t.donate.leadBefore}
                <span className="font-bold text-white">{t.donate.leadAmount}</span>
                {t.donate.leadAfter}
              </DialogDescription>
            </div>
          </div>
        </div>

        <DonateBody open={donateOpen} />

        <div className="flex flex-col gap-1.5 border-t border-white/10 px-4 py-3">
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
            {t.donate.footer}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => {
              markSeen()
              setDonateOpen(false)
            }}
          >
            {t.donate.notNow}
          </Button>
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
    <div className="px-2 pb-2 pt-3 sm:px-3">
      {cfg.data?.last && <PendingDonation last={cfg.data.last} />}
      <DonationWidget />
    </div>
  )
}

/** Aviso de la última donación que dejó algo a medias: confirmarse o compartirse. */
function PendingDonation({ last }: { last: NonNullable<DonateConfigDTO['last']> }) {
  const t = useT()
  const setDonateThanksId = useUI((s) => s.setDonateThanksId)
  const setDonateOpen = useUI((s) => s.setDonateOpen)
  if (last.shared) return null

  return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/[0.08] p-3.5">
      <Send className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-primary">
          {last.confirmed
            ? t.donate.confirmed(fmtUsd(last.amountUsd))
            : t.donate.confirming(fmtUsd(last.amountUsd))}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {last.confirmed ? t.donate.sharePending(last.shareBonus) : t.donate.willCredit}
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
          {last.confirmed ? t.donate.share(last.shareBonus) : t.donate.seeStatus}
        </Button>
      </div>
    </div>
  )
}

/**
 * El widget, con las instrucciones delante.
 *
 * El embed viene en inglés y no preselecciona moneda (la cuenta no tiene página
 * de donación configurada: su `donation-settings-by-apiKey` responde 404). Quien
 * no despliega «Choose asset» pulsa Continue y solo recibe un «Please fill in
 * the missing information» en rosa pálido, así que parece que se ha colgado.
 * Por eso el aviso va aquí fuera, en español.
 *
 * El embed mide 346×623 y se deja EXACTAMENTE así. Nada de encogerlo: ni con
 * `transform: scale()` ni con `zoom`, porque en cuanto el iframe se escala
 * Chrome deja de acertar dónde se ha pulsado dentro de él y los clics se
 * pierden (probado: con zoom 0.62 no llega ni un pointerdown al widget). Si la
 * pantalla es más estrecha que el embed, se desplaza de lado y ya está.
 */
function DonationWidget() {
  const t = useT()
  return (
    <div className="w-full">
      <p className="mb-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-3 py-2 text-[12px] leading-snug text-foreground/90">
        <span className="font-bold text-primary">{t.donate.heads}</span>
        {t.donate.widgetHintBefore}
        <span className="font-bold text-primary">{t.donate.widgetHintAsset}</span>
        {t.donate.widgetHintAfter}
      </p>
      <div className="w-full overflow-x-auto">
        <iframe
          src={WIDGET_URL}
          title={t.donate.widgetTitle}
          width={WIDGET_W}
          height={WIDGET_H}
          loading="lazy"
          className="mx-auto block rounded-xl border-0"
        >
          {t.donate.widgetFallback}
        </iframe>
      </div>
      <a
        href={PAGE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-muted-foreground/80 underline-offset-2 hover:text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t.donate.stuck}
      </a>
    </div>
  )
}
