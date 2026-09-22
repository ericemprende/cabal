'use client'

import { Bomb, CalendarClock, CheckCircle2, CreditCard, Crown, Loader2, RefreshCcw, Wallet } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useOpenBillingPortal, usePremiumInfo, useSession, useStartPremiumCheckout } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { bulletsAsTime } from '@/components/cabal/ammo'
import type { PremiumPlanDTO } from '@/lib/types'

const BENEFITS = [
  'La wallet del dev, si se conoce',
  'El launchpad donde sale el token',
  'El contrato, si ya existe antes del lanzamiento',
  'Insignia de verificado para tu perfil y tus launches, frente a clones',
  'Valorar a otras personas (confío / no confío) y dejar reseñas públicas',
]

/**
 * Diálogo para hacerse Premium: elegir plan (mensual/anual) y pasarela
 * (tarjeta con Stripe o cripto con NOWPayments). El acceso se activa cuando el
 * proveedor confirma el pago, no al pulsar el botón: por eso, con tarjeta, se
 * vuelve a /app?premium=ok&session_id=… y ese retorno confirma el pago sin
 * esperar al webhook (ver useConfirmPremiumCheckout en app/page.tsx).
 */
export function PremiumDialog() {
  const { premiumOpen, setPremiumOpen, openAuth } = useUI()
  const { data: session } = useSession()
  const { data: info, isPending } = usePremiumInfo(premiumOpen)
  const checkout = useStartPremiumCheckout()
  const portal = useOpenBillingPortal()

  const loggedIn = Boolean(session?.loggedIn)

  return (
    <Dialog open={premiumOpen} onOpenChange={setPremiumOpen}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto border-amber-400/20 bg-[#121410] p-0 sm:max-w-3xl" aria-describedby={undefined}>
        <div className="relative overflow-hidden border-b border-white/10 p-5">
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10">
              <Crown className="h-5 w-5 fill-amber-300 text-amber-300" aria-hidden />
            </span>
            <div>
              <DialogTitle className="font-display text-lg font-bold">Cabal Premium</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Desbloquea la información completa de cada proyecto
              </DialogDescription>
            </div>
          </div>
          <ul className="relative mt-4 space-y-1.5">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[13px] text-foreground/85">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5">
          {!loggedIn ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Inicia sesión para suscribirte a Premium.</p>
              <Button
                onClick={() => {
                  setPremiumOpen(false)
                  openAuth('login')
                }}
                className="px-5 font-bold"
              >
                Iniciar sesión
              </Button>
            </div>
          ) : isPending || !info ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : info.status.active ? (
            <ActiveStatus
              status={info.status}
              onManage={() => portal.mutate(window.open('', '_blank'))}
              managing={portal.isPending}
            />
          ) : (
            <div className="space-y-4">
              {info.plans.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-muted-foreground">
                  Todavía no hay planes a la venta. Vuelve pronto.
                </p>
              )}
              {/* Uno al lado del otro: se comparan de un vistazo en vez de scrolleando */}
              <div className="grid gap-3 sm:grid-cols-3">
                {info.plans.map((plan) => (
                  <PlanCard
                    key={plan.key}
                    plan={plan}
                    paying={checkout.isPending ? checkout.variables?.plan === plan.key : false}
                    onPay={(method) => {
                      // La pestaña se abre ya, en el propio clic: si se abre después
                      // (cuando responda el checkout) el navegador la bloquea.
                      const popup = window.open('', '_blank')
                      checkout.mutate({ plan: plan.key, method, popup })
                    }}
                  />
                ))}
              </div>

              {info.plans.some((p) => p.ammoBullets > 0) && <AmmoExplainer plans={info.plans} />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** $72 o $72.50: sin céntimos cuando el importe es redondo. */
function formatUsd(n: number) {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`
}

function PlanCard({
  plan,
  paying,
  onPay,
}: {
  plan: PremiumPlanDTO
  paying: boolean
  onPay: (method: 'card' | 'crypto') => void
}) {
  const highlighted = plan.savingsPct > 0
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border p-4',
        highlighted ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10 bg-[#0a0b08]'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{plan.label}</p>
        {highlighted && (
          <span className="shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
            −{plan.savingsPct}%
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-machina text-2xl font-bold">{formatUsd(plan.priceUsd)}</span>
        {plan.fullPriceUsd !== null && (
          <span className="text-[11px] text-muted-foreground line-through">{formatUsd(plan.fullPriceUsd)}</span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        ${plan.perMonthUsd.toFixed(2)}/mes · {plan.months} {plan.months === 1 ? 'mes' : 'meses'}
      </p>
      {highlighted && plan.savingsUsd > 0 && (
        <p className="mt-0.5 text-[11px] font-semibold text-amber-300/90">
          Ahorras {formatUsd(plan.savingsUsd)} frente al mensual
        </p>
      )}

      {/* Lo que más vende del plan: la munición que trae y para cuánto da */}
      {plan.ammoBullets > 0 && (
        <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-400/[0.07] p-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300/90">
            <Bomb className="h-3 w-3" strokeWidth={3} aria-hidden /> Incluye munición
          </p>
          <p className="mt-1 font-mono text-lg font-bold leading-none tabular-nums text-amber-200">
            {plan.ammoBullets.toLocaleString('es')}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-foreground/80">
            balas = <span className="font-bold text-amber-200">{bulletsAsTime(plan.ammoBullets)}</span> con tu proyecto
            destacado arriba del Radar
          </p>
        </div>
      )}

      <div className="mt-3 grid gap-2 pt-1">
        <Button
          size="sm"
          disabled={!plan.card || paying}
          onClick={() => onPay('card')}
          className="gap-1.5 text-xs font-bold disabled:opacity-40"
        >
          {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" aria-hidden />}
          Tarjeta
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!plan.crypto || paying}
          onClick={() => onPay('crypto')}
          className="gap-1.5 border-white/15 bg-transparent text-xs font-bold hover:bg-white/5 disabled:opacity-40"
        >
          <Wallet className="h-3.5 w-3.5" aria-hidden /> Cripto
        </Button>
      </div>
      {!plan.card && !plan.crypto && (
        <p className="mt-2 text-[10px] text-muted-foreground">Este plan no tiene ninguna pasarela activa todavía.</p>
      )}
    </div>
  )
}

/**
 * Qué es la munición y para qué sirve. Va debajo de los planes porque el
 * número de balas no dice nada por sí solo: lo que se compra es estar arriba
 * del Radar con el gráfico y el botón de comprar delante de todo el mundo.
 */
function AmmoExplainer({ plans }: { plans: PremiumPlanDTO[] }) {
  const best = plans.reduce((a, b) => (b.ammoBullets > a.ammoBullets ? b : a))
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Bomb className="h-4 w-4 text-amber-300" strokeWidth={2.5} aria-hidden />
        ¿Qué es la munición?
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        Cada bala es <span className="font-semibold text-foreground/90">un minuto</span> de tu proyecto destacado en lo
        alto del Radar: banner grande con tu gráfico en vivo y el botón de comprar a la vista, más tu ticker pasando por
        la cinta superior en todas las pestañas de Cabal.
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {[
          `Tu plan ya trae balas de regalo — hasta ${best.ammoBullets.toLocaleString('es')} con el ${best.label.toLowerCase()}`,
          'Las gastas cuando quieras: no caducan hasta que las disparas',
          'Puedes sumarlas a un proyecto tuyo o empujar el de otro',
          'Si quieres más, se compran aparte en cargadores',
        ].map((line) => (
          <li key={line} className="flex items-start gap-2 text-[12px] text-foreground/85">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActiveStatus({
  status,
  onManage,
  managing,
}: {
  status: NonNullable<ReturnType<typeof usePremiumInfo>['data']>['status']
  onManage: () => void
  managing: boolean
}) {
  const until = status.until ? new Date(status.until).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/8 p-4 text-center">
        <Crown className="mx-auto h-6 w-6 fill-amber-300 text-amber-300" aria-hidden />
        <p className="mt-1.5 text-sm font-bold text-amber-200">Ya eres Premium</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {until
            ? status.cancelAtPeriodEnd
              ? `Activo hasta el ${until} (no se renovará)`
              : status.renews
                ? `Se renueva el ${until}`
                : `Activo hasta el ${until}`
            : 'Sin fecha de caducidad'}
        </p>
        {status.pastDue && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#ff8080]">
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden /> No pudimos cobrar la renovación. Revisa tu método de pago.
          </p>
        )}
      </div>
      {status.canManageBilling && (
        <Button
          onClick={onManage}
          disabled={managing}
          variant="outline"
          className="w-full gap-2 border-white/15 bg-transparent font-bold hover:bg-white/5"
        >
          <CalendarClock className="h-4 w-4" aria-hidden /> {managing ? 'Abriendo…' : 'Gestionar facturación'}
        </Button>
      )}
    </div>
  )
}
