'use client'

import { useMemo, useState } from 'react'
import { Bomb, Crown, CreditCard, Crosshair, Loader2, Sparkles, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAmmoInfo, useBoostScores, useBuyAmmoPack, useFireAmmo, useSession } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { Bullet, BulletRow, bulletsAsTime, fmtBullets } from '@/components/cabal/ammo'
import { TokenGlyph } from '@/components/cabal/shared'
import type { AmmoPackDTO, BoostScoreDTO } from '@/lib/types'

/**
 * El arsenal: comprar cargadores de balas y dispararlas sobre un proyecto.
 *
 * Una bala = un minuto arriba del Radar, con el gráfico y el botón de comprar
 * a la vista. Se abre desde la granada de la cabecera (solo comprar) o desde
 * la ficha de un proyecto (con el objetivo ya cargado).
 */
export function AmmoDialog() {
  const { ammoOpen, ammoTarget, setAmmoOpen, openAuth, setPremiumOpen } = useUI()
  const { data: session } = useSession()
  const { data: info, isPending } = useAmmoInfo(ammoOpen)
  const loggedIn = Boolean(session?.loggedIn)

  return (
    <Dialog open={ammoOpen} onOpenChange={setAmmoOpen}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-amber-400/25 bg-[#121410] p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        {/* Cabecera: la granada, el saldo y qué compra esto */}
        <div className="relative overflow-hidden border-b border-white/10 p-5">
          <div className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10">
              <Bomb className="h-5 w-5 text-amber-300" strokeWidth={2.5} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-display text-lg font-bold">Arsenal</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Una bala = un minuto arriba del Radar, con el gráfico listo y el botón de comprar a la vista.
              </DialogDescription>
            </div>
            {loggedIn && info && (
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tus balas</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-amber-300">
                  {info.balance.toLocaleString('es')}
                </p>
              </div>
            )}
          </div>
          {loggedIn && info && info.balance > 0 && (
            <div className="relative mt-3 flex items-center gap-2">
              <BulletRow count={Math.ceil((info.balance / 1440) * 12)} max={12} />
              <span className="text-[11px] text-muted-foreground">
                {bulletsAsTime(info.balance)} de proyecto destacado
              </span>
            </div>
          )}
        </div>

        {!loggedIn ? (
          <div className="space-y-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">Inicia sesión para conseguir munición.</p>
            <Button
              onClick={() => {
                setAmmoOpen(false)
                openAuth('login')
              }}
              className="px-5 font-bold"
            >
              Iniciar sesión
            </Button>
          </div>
        ) : isPending || !info ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-5 p-5">
            {info.promo && <PromoBanner promo={info.promo} />}

            {ammoTarget && <FireSection balance={info.balance} goldenAt={info.goldenAt} />}

            <PackGrid packs={info.packs} hasTarget={Boolean(ammoTarget)} />

            {/* Dos ganchos: el cargador dorado y la munición que regala el plan */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-xl border border-amber-300/25 bg-gradient-to-r from-amber-400/10 to-transparent p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <p className="text-[12px] leading-relaxed text-foreground/85">
                  <span className="font-bold text-amber-200">Cargador Dorado</span> a partir de{' '}
                  {info.goldenAt.toLocaleString('es')} balas activas: el proyecto sale dorado y con destello en todo Cabal.
                </p>
              </div>
              <button
                onClick={() => {
                  setAmmoOpen(false)
                  setPremiumOpen(true)
                }}
                className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-amber-300/40"
              >
                <Crown className="mt-0.5 h-4 w-4 shrink-0 fill-amber-300 text-amber-300" aria-hidden />
                <p className="text-[12px] leading-relaxed text-foreground/85">
                  Los planes <span className="font-bold text-amber-200">Premium</span> regalan munición al activarse:
                  desde {fmtBullets(smallestGift(info.planGifts))} balas.
                </p>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Promoción de lanzamiento: el descuento y hasta cuándo dura. */
function PromoBanner({ promo }: { promo: { pct: number; until: string | null } }) {
  const until = promo.until
    ? new Date(promo.until).toLocaleDateString('es', { day: 'numeric', month: 'long' })
    : null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5">
      <span className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-primary-foreground">
        −{promo.pct}%
      </span>
      <p className="text-[13px] font-semibold text-foreground/90">
        Promoción de lanzamiento en todos los cargadores
      </p>
      {until && <span className="ml-auto text-[11px] text-muted-foreground">hasta el {until}</span>}
    </div>
  )
}

/** El regalo más pequeño de los planes: el gancho que se enseña. 0 si ninguno regala. */
function smallestGift(gifts: Record<string, number>): number {
  const given = Object.values(gifts).filter((n) => n > 0)
  return given.length ? Math.min(...given) : 0
}

/** Atajos de disparo: los tres que cubren el 90 % de los casos. */
const QUICK_SHOTS = [
  { bullets: 60, label: '1 h' },
  { bullets: 360, label: '6 h' },
  { bullets: 1440, label: '24 h' },
]

/** Elegir cuántas balas gastar sobre el objetivo y dispararlas. */
function FireSection({ balance, goldenAt }: { balance: number; goldenAt: number }) {
  const { ammoTarget, setAmmoOpen } = useUI()
  const fire = useFireAmmo()
  const { data: scores } = useBoostScores()
  const [chosen, setChosen] = useState(() => Math.min(balance, 1440) || 60)

  // El saldo cambia solo (un disparo, una compra que acaba de entrar), así que
  // lo elegido se acota al renderizar en lugar de guardarse ya acotado: nunca
  // se puede pedir más de lo que hay.
  const bullets = Math.max(1, Math.min(chosen, Math.max(balance, 1)))
  const setBullets = setChosen

  if (!ammoTarget) return null
  const enough = balance >= bullets && balance > 0

  return (
    <section className="rounded-xl border border-amber-400/25 bg-amber-400/[0.04] p-4">
      <div className="flex items-center gap-2.5">
        <Crosshair className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Objetivo</p>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <TokenGlyph src={ammoTarget.image} ticker={ammoTarget.name} size="xs" className="rounded-full" />
          <span className="min-w-0 truncate text-sm font-bold">{ammoTarget.name}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {QUICK_SHOTS.map((q) => (
          <button
            key={q.bullets}
            onClick={() => setBullets(q.bullets)}
            disabled={balance < q.bullets}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35',
              bullets === q.bullets
                ? 'border-amber-300/60 bg-amber-400/15 text-amber-200'
                : 'border-white/10 text-muted-foreground hover:border-amber-300/40'
            )}
          >
            {q.label}
          </button>
        ))}
        <button
          onClick={() => setBullets(Math.max(1, balance))}
          disabled={balance <= 0}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35',
            bullets === balance && balance > 0
              ? 'border-amber-300/60 bg-amber-400/15 text-amber-200'
              : 'border-white/10 text-muted-foreground hover:border-amber-300/40'
          )}
        >
          Todo
        </button>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="sr-only sm:not-sr-only">Balas</span>
          <input
            type="number"
            min={1}
            max={Math.max(balance, 1)}
            value={bullets}
            onChange={(e) => {
              const n = Math.floor(Number(e.target.value))
              setBullets(Number.isFinite(n) ? Math.max(1, Math.min(n, Math.max(balance, 1))) : 1)
            }}
            className="w-24 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-right font-mono text-sm tabular-nums text-amber-300 outline-none focus:border-amber-300/50"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <BulletRow count={Math.ceil((bullets / 1440) * 12)} max={12} />
        <p className="text-[13px] text-foreground/85">
          <span className="font-bold text-amber-300">{bullets.toLocaleString('es')} balas</span> ={' '}
          {bulletsAsTime(bullets)} destacado
        </p>
      </div>

      <RankMeter
        scores={scores}
        targetKey={`${ammoTarget.type}:${ammoTarget.id}`}
        adding={bullets}
        balance={balance}
        goldenAt={goldenAt}
        onPickBullets={setBullets}
      />

      <Button
        disabled={!enough || fire.isPending}
        onClick={() =>
          fire.mutate(
            { targetType: ammoTarget.type, targetId: ammoTarget.id, bullets },
            {
              onSuccess: () => {
                toast.success(`¡Fuego! ${bullets.toLocaleString('es')} balas sobre ${ammoTarget.name}`)
                setAmmoOpen(false)
              },
            }
          )
        }
        className="mt-3 w-full bg-amber-400 font-black uppercase tracking-wider text-[#1a1406] hover:bg-amber-300 disabled:opacity-40"
      >
        {fire.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : enough ? (
          <>
            <Bomb className="h-4 w-4" strokeWidth={2.5} /> Disparar
          </>
        ) : (
          'Te faltan balas — compra un cargador'
        )}
      </Button>
    </section>
  )
}

/** Los cargadores a la venta, al estilo de una vitrina de armería. */
function PackGrid({ packs, hasTarget }: { packs: AmmoPackDTO[]; hasTarget: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null)
  const buy = useBuyAmmoPack()

  // El que más balas por dólar da: se marca para que no haya que hacer cuentas.
  const bestKey = useMemo(() => {
    let best: AmmoPackDTO | null = null
    for (const p of packs) if (!best || p.bullets / p.priceUsd > best.bullets / best.priceUsd) best = p
    return best?.key ?? null
  }, [packs])

  if (packs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-muted-foreground">
        Todavía no hay cargadores a la venta. Vuelve pronto.
      </p>
    )
  }

  return (
    <section className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {hasTarget ? 'Recargar' : 'Elige tu cargador'}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {packs.map((p) => {
          const on = chosen === p.key
          return (
            <button
              key={p.key}
              onClick={() => setChosen(on ? null : p.key)}
              aria-pressed={on}
              className={cn(
                'group relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border p-3 text-center transition-all',
                on
                  ? 'border-amber-300/70 bg-amber-400/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-amber-300/40 hover:bg-amber-400/5'
              )}
            >
              {p.key === bestKey && (
                <span className="absolute right-0 top-0 rounded-bl-lg bg-amber-400 px-1.5 py-px text-[8px] font-black uppercase tracking-wider text-[#1a1406]">
                  Mejor
                </span>
              )}
              <BulletRow count={Math.min(6, Math.ceil(p.bullets / 500))} max={6} animated={false} className="h-5" />
              <p className="font-display text-lg font-black leading-none text-amber-300">{fmtBullets(p.bullets)}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{p.label}</p>
              <p className="text-[11px] text-foreground/70">{bulletsAsTime(p.bullets)}</p>
              <p className="mt-0.5 font-mono text-base font-bold tabular-nums">${p.priceUsd}</p>
              {p.savingsPct > 0 && (
                <p className="text-[10px] font-bold text-primary">−{p.savingsPct}%</p>
              )}
            </button>
          )
        })}
      </div>

      {/* Los métodos de pago solo aparecen con un cargador elegido */}
      {chosen && (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row">
          {(() => {
            const pack = packs.find((p) => p.key === chosen)
            if (!pack) return null
            const pay = (method: 'card' | 'crypto') => {
              // La pestaña se abre dentro del propio clic o el navegador la bloquea.
              const popup = window.open('', '_blank')
              buy.mutate({ pack: pack.key, method, popup })
            }
            const loading = buy.isPending
            return (
              <>
                <Button
                  disabled={!pack.card || loading}
                  onClick={() => pay('card')}
                  className="flex-1 bg-amber-400 font-bold text-[#1a1406] hover:bg-amber-300 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {pack.card ? `Tarjeta · $${pack.priceUsd}` : 'Tarjeta no disponible'}
                </Button>
                <Button
                  disabled={!pack.crypto || loading}
                  variant="outline"
                  onClick={() => pay('crypto')}
                  className="flex-1 border-white/15 font-bold hover:border-amber-300/50 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {pack.crypto ? 'Cripto' : 'Cripto no disponible'}
                </Button>
              </>
            )
          })()}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Bullet className="h-3 w-[6px] text-amber-300/60" />
        Las balas no caducan: se gastan solo cuando las disparas.
      </p>
    </section>
  )
}

/**
 * En qué puesto quedaría el proyecto con las balas elegidas, y cuántas le
 * faltan para el banner. Es lo que convierte la compra en una puja: sin ver el
 * marcador, nadie sube la apuesta.
 */
function RankMeter({
  scores,
  targetKey,
  adding,
  balance,
  goldenAt,
  onPickBullets,
}: {
  scores: Record<string, BoostScoreDTO> | undefined
  targetKey: string
  adding: number
  balance: number
  goldenAt: number
  onPickBullets: (n: number) => void
}) {
  if (!scores) return null

  const mine = scores[targetKey]?.bullets ?? 0
  const rivals = Object.entries(scores)
    .filter(([k]) => k !== targetKey)
    .map(([, v]) => v.bullets)
    .sort((a, b) => b - a)

  const projected = mine + adding
  const leader = rivals[0] ?? 0
  const rank = 1 + rivals.filter((b) => b > projected).length
  const total = rivals.length + 1
  // Balas a disparar AHORA para pasar al primero (no el total que tendría)
  const toBeFirst = Math.max(1, leader + 1 - mine)
  const first = rank === 1
  const canAfford = toBeFirst <= balance
  const goesGolden = projected >= goldenAt && mine < goldenAt

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Quedarías</p>
        <p className="text-[12px] text-muted-foreground">
          <span className={cn('text-xl font-black tabular-nums', first ? 'text-amber-300' : 'text-foreground')}>
            {rank}º
          </span>{' '}
          de {total}
        </p>
      </div>

      {/* Lo tuyo frente al que manda ahora mismo */}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className={cn('h-full rounded-full', first ? 'bg-amber-300' : 'bg-amber-400/50')}
          style={{ width: `${Math.min(100, (projected / Math.max(leader, projected, 1)) * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
        {projected.toLocaleString('es')} balas
        {!first && ` · el nº1 tiene ${leader.toLocaleString('es')}`}
      </p>

      {first ? (
        <p className="mt-2 text-[12px] font-semibold text-amber-200">
          Te llevas el banner grande del Radar{goesGolden ? ' y entras en Cargador Dorado' : ''}.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[12px] text-foreground/85">
            Te faltan <span className="font-bold text-amber-300">{(leader + 1 - projected).toLocaleString('es')}</span>{' '}
            balas para el banner.
          </p>
          {canAfford ? (
            <button
              onClick={() => onPickBullets(toBeFirst)}
              className="rounded-full border border-amber-300/50 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-400/20"
            >
              Disparar {toBeFirst.toLocaleString('es')} y al nº1
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              (necesitarías {toBeFirst.toLocaleString('es')} balas de golpe)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
