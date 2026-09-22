'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { HandHeart, Loader2, Send, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUI } from '@/lib/store'
import { jsonFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  DONATE_CURRENCIES,
  DONATE_DEFAULT_CURRENCY,
  donationPoints,
  fmtUsd,
  normalizeDonationAmount,
  type DonateConfigDTO,
} from '@/lib/donate'

/**
 * Donaciones en cripto. Hay dos caminos, y el que se enseña depende de la
 * sesión:
 *
 *  - Con cuenta (y con claves de NOWPayments en el servidor): se elige el
 *    importe aquí y el servidor abre una factura NUESTRA. Así sabemos cuánto se
 *    donó cuando la red confirma, y eso es lo que se convierte en puntos Cabal
 *    (ver lib/donate-server.ts). Al volver del pago sale la tarjeta para X.
 *  - Sin cuenta: el widget embebido de toda la vida. Cobra igual, pero pasa por
 *    fuera de nosotros, así que no hay importe que puntuar ni a quién abonárselo.
 *
 * La key del widget es pública por diseño (va en el src del iframe, a la vista
 * de cualquiera); se deja en una variable de entorno solo para poder rotarla sin
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

/**
 * El cuerpo: el selector de importe con puntos si se puede facturar, y el widget
 * embebido si no (sin sesión, o sin claves de NOWPayments en el servidor).
 */
function DonateBody({ open }: { open: boolean }) {
  const cfg = useQuery<DonateConfigDTO>({
    queryKey: ['donate', 'config'],
    queryFn: () => jsonFetch('/api/donate'),
    enabled: open,
  })

  const data = cfg.data
  const withPoints = Boolean(data?.invoices && data?.signedIn)

  return (
    <div className="px-3 pb-3 pt-4">
      {data?.last && <PendingDonation last={data.last} />}
      {!data ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : withPoints ? (
        <AmountPicker cfg={data} />
      ) : (
        <>
          {data.invoices && !data.signedIn && (
            <p className="mb-3 flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] p-3 text-[12.5px] leading-relaxed text-foreground/90">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                Entra con tu cuenta antes de donar y te llevas{' '}
                <span className="font-bold text-primary">{data.pointsPerUsd} puntos Cabal por cada $1</span>{' '}
                más tu tarjeta para compartir en X. Sin cuenta la donación llega igual, pero no hay
                a quién abonarle los puntos.
              </span>
            </p>
          )}
          <DonationWidget />
        </>
      )}
    </div>
  )
}

/**
 * Selector de importe. Los puntos se calculan aquí mismo con la regla vigente
 * para que se vean mientras se elige; los que se abonan de verdad los calcula el
 * servidor sobre el importe que confirme la red.
 */
function AmountPicker({ cfg }: { cfg: DonateConfigDTO }) {
  const setDonateThanksId = useUI((s) => s.setDonateThanksId)
  const setDonateOpen = useUI((s) => s.setDonateOpen)
  const [picked, setPicked] = useState<number>(cfg.presets[1] ?? cfg.presets[0] ?? 10)
  const [custom, setCustom] = useState('')
  // Solana de entrada: es la moneda con el mínimo más bajo de la pasarela.
  const [currency, setCurrency] = useState<string>(DONATE_DEFAULT_CURRENCY)
  const [showWidget, setShowWidget] = useState(false)

  const amount = custom.trim() ? normalizeDonationAmount(custom) : picked
  const points = amount === null ? 0 : donationPoints(amount, cfg.pointsPerUsd)

  const start = useMutation({
    mutationFn: (v: { amountUsd: number; currency: string; popup: Window | null }) =>
      jsonFetch<{ url: string; donationId: string; points: number }>('/api/donate', {
        method: 'POST',
        body: JSON.stringify({ amountUsd: v.amountUsd, currency: v.currency }),
      }),
    onSuccess: (res, v) => {
      // La factura se abre en la pestaña que ya reservó el clic; si el navegador
      // la bloqueó, se navega esta misma (y la vuelta del pago trae /app?donated=…).
      if (v.popup && !v.popup.closed) v.popup.location.href = res.url
      else window.location.assign(res.url)
      // La pantalla de gracias queda abierta esperando la confirmación: ahí está
      // la tarjeta para X, y desde ahí se cobra el bonus por compartirla.
      setDonateOpen(false)
      setDonateThanksId(res.donationId)
    },
    onError: (e: Error, v) => {
      v.popup?.close()
      toast.error(e.message)
    },
  })

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Elige cuánto donas
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {cfg.presets.map((p) => {
            const active = !custom.trim() && picked === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setCustom('')
                  setPicked(p)
                }}
                aria-pressed={active}
                className={cn(
                  'rounded-xl border py-2.5 font-mono text-[14px] font-bold transition-colors',
                  active
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-white/10 bg-[#0a0b08] text-foreground/80 hover:border-primary/40'
                )}
              >
                {fmtUsd(p)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="donate-custom" className="text-[12.5px] text-muted-foreground">
          U otro importe
        </label>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-muted-foreground">
            $
          </span>
          <Input
            id="donate-custom"
            type="number"
            inputMode="decimal"
            min={cfg.minUsd}
            max={cfg.maxUsd}
            step="0.01"
            placeholder={String(cfg.maxUsd >= 250 ? 250 : cfg.maxUsd)}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="h-10 border-white/10 bg-[#0a0b08] pl-7 font-mono font-bold text-primary"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Y en qué moneda
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DONATE_CURRENCIES.map((c) => {
            const active = currency === c.code
            return (
              <button
                key={c.code || 'any'}
                type="button"
                onClick={() => setCurrency(c.code)}
                aria-pressed={active}
                className={cn(
                  'rounded-xl border px-2.5 py-2 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/15'
                    : 'border-white/10 bg-[#0a0b08] hover:border-primary/40'
                )}
              >
                <span
                  className={cn(
                    'block font-mono text-[13px] font-bold',
                    active ? 'text-primary' : 'text-foreground/80'
                  )}
                >
                  {c.label}
                </span>
                <span className="block truncate text-[10.5px] leading-tight text-muted-foreground">
                  {c.hint}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.07] px-3.5 py-3">
        <Zap className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-[13px] leading-snug text-foreground/90">
          {amount === null ? (
            <>
              Importes entre {fmtUsd(cfg.minUsd)} y {fmtUsd(cfg.maxUsd)}.
            </>
          ) : (
            <>
              Te llevas <span className="font-mono font-bold text-primary">+{points.toLocaleString('es')}</span>{' '}
              puntos Cabal ({cfg.pointsPerUsd} por cada $1) y{' '}
              <span className="font-bold text-primary">+{cfg.shareBonus}</span> más al compartir tu
              tarjeta en X.
            </>
          )}
        </p>
      </div>

      <Button
        disabled={amount === null || start.isPending}
        onClick={() => {
          if (amount === null) return
          // La pestaña se abre ya, en el propio clic: si se abre después (cuando
          // responda el servidor) el navegador la bloquea.
          const popup = window.open('', '_blank')
          start.mutate({ amountUsd: amount, currency, popup })
        }}
        className="h-12 w-full gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground hover:bg-[#9dba46]"
      >
        {start.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <HandHeart className="h-4 w-4" aria-hidden />
        )}
        Donar {amount === null ? '' : fmtUsd(amount)}
      </Button>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground/80">
        {currency
          ? 'La pasarela se abre ya en esa moneda, y allí se puede cambiar. '
          : 'Eliges la moneda en la pasarela. '}
        Los puntos entran en cuanto la red confirma el pago.
      </p>

      {/* Salida de emergencia: si la pasarela falla, el widget de siempre sigue
          cobrando (sin puntos, porque pasa por fuera de nosotros). */}
      {showWidget ? (
        <div className="border-t border-white/10 pt-3">
          <p className="mb-2 text-[11px] text-muted-foreground">
            Widget clásico: la donación llega igual, pero esta vía no abona puntos.
          </p>
          <DonationWidget />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowWidget(true)}
          className="w-full text-center text-[11px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
        >
          Prefiero el widget de siempre
        </button>
      )}
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
          className="mt-2 h-8 gap-1.5 rounded-lg bg-primary text-[12.5px] font-bold text-primary-foreground hover:bg-[#9dba46]"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          {last.confirmed ? `Compartir +${last.shareBonus}` : 'Ver estado'}
        </Button>
      </div>
    </div>
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
