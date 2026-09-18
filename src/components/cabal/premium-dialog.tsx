'use client'

import { CalendarClock, CheckCircle2, CreditCard, Crown, Loader2, RefreshCcw, Wallet } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useOpenBillingPortal, usePremiumInfo, useSession, useStartPremiumCheckout } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import type { PremiumPlanDTO } from '@/lib/types'

const BENEFITS = [
  'La wallet del dev, si se conoce',
  'El launchpad donde sale el token',
  'El contrato, si ya existe antes del lanzamiento',
  'Insignia de verificado para tu perfil y tus launches, frente a clones',
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
      <DialogContent className="max-h-[88dvh] overflow-y-auto border-amber-400/20 bg-[#121410] p-0 sm:max-w-md" aria-describedby={undefined}>
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
                className="h-10 rounded-xl bg-primary px-5 font-bold text-primary-foreground hover:bg-[#8FA83F]"
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
            <div className="space-y-3">
              {info.plans.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-muted-foreground">
                  Todavía no hay planes a la venta. Vuelve pronto.
                </p>
              )}
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
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
        'rounded-xl border p-4',
        highlighted ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10 bg-[#0a0b08]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold">
            {plan.label}
            {highlighted && (
              <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                AHORRA {plan.savingsPct}%
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            ${plan.perMonthUsd.toFixed(2)}/mes · {plan.months} {plan.months === 1 ? 'mes' : 'meses'}
          </p>
        </div>
        <p className="font-machina text-xl font-bold">${plan.priceUsd}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          disabled={!plan.card || paying}
          onClick={() => onPay('card')}
          className="h-9 gap-1.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:bg-[#8FA83F] disabled:opacity-40"
        >
          {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" aria-hidden />}
          Tarjeta
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!plan.crypto || paying}
          onClick={() => onPay('crypto')}
          className="h-9 gap-1.5 rounded-lg border-white/15 bg-transparent text-xs font-bold hover:bg-white/5 disabled:opacity-40"
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
          className="h-10 w-full gap-2 rounded-xl border-white/15 bg-transparent font-bold hover:bg-white/5"
        >
          <CalendarClock className="h-4 w-4" aria-hidden /> {managing ? 'Abriendo…' : 'Gestionar facturación'}
        </Button>
      )}
    </div>
  )
}
