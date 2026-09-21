'use client'

import { Bomb, Crosshair, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUI } from '@/lib/store'
import { useBoostedItems, type BoostedItem } from '@/lib/use-boosted'
import { BoostButton, BoostCounter, Magazine, fmtBullets } from '@/components/cabal/ammo'
import { CountdownPill, NetworkBadge, OfficialBadge, TokenGlyph } from '@/components/cabal/shared'
import { LiveChart } from '@/components/cabal/live-chart'
import { fmtMc, fmtPct } from '@/lib/cabal'

/**
 * El sitio de honor: el proyecto con más munición viva de todo Cabal, launch o
 * token. Uno solo — para quitárselo hay que disparar más que él.
 *
 * Por eso no rota: el gráfico en vivo es un iframe de terceros y cambiarlo
 * cada pocos segundos lo dejaría recargando sin parar.
 */
export function BoostHero({ item }: { item: BoostedItem }) {
  const { openLaunch, openToken } = useUI()
  const open = () => (item.kind === 'launch' ? openLaunch(item.id) : openToken(item.id))
  const golden = item.boost.golden
  const launch = item.launch
  const token = item.token

  return (
    <section
      className={cn(
        'card-surface relative overflow-hidden rounded-2xl border p-5 sm:p-6',
        golden
          ? 'border-amber-300/60 shadow-[0_0_28px_rgba(255,176,32,0.12)]'
          : 'border-amber-400/35 shadow-[0_0_18px_rgba(255,176,32,0.06)]'
      )}
      aria-label={`Proyecto destacado con munición: ${item.label}`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/12 blur-3xl" />
      {golden && (
        <span className="pointer-events-none absolute inset-y-0 w-24 animate-ammo-shine bg-gradient-to-r from-transparent via-amber-200/10 to-transparent" />
      )}

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Identidad y munición */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest',
                golden ? 'bg-amber-300 text-[#1a1406]' : 'bg-amber-400/20 text-amber-200'
              )}
            >
              <Bomb className="h-3 w-3" strokeWidth={3} aria-hidden />
              {golden ? 'Cargador dorado' : 'Destacado con munición'}
            </span>
            <NetworkBadge network={item.network} />
            <BoostCounter boost={item.boost} />
            {item.boost.shooters > 1 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <Crosshair className="h-3 w-3" aria-hidden /> {item.boost.shooters} disparando
              </span>
            )}
          </div>

          <button onClick={open} className="min-w-0 text-left outline-none">
            <h2 className="font-display flex min-w-0 flex-wrap items-center gap-x-2 text-xl font-bold sm:text-2xl">
              <span className="text-primary text-glow">{item.label}</span>
              <span className="min-w-0 truncate text-foreground/85">{item.name}</span>
              {(launch?.verified || token?.verified) && (
                <OfficialBadge label title="Proyecto oficial verificado por Cabal" />
              )}
            </h2>
            {launch?.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{launch.description}</p>
            )}
          </button>

          {/* Datos de mercado (token) o cuenta atrás (launch aún sin salir) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {token && (
              <>
                <span className="font-mono text-lg font-bold">{fmtMc(token.mc)}</span>
                <span className={cn('text-sm font-bold', token.change24h >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
                  {fmtPct(token.change24h)} 24h
                </span>
              </>
            )}
            {launch && <CountdownPill target={launch.launchAt} size="sm" estimated={!launch.dateConfirmed} />}
          </div>

          {/* El cargador: se vacía a la vista y pega un fogonazo al recargarse */}
          <Magazine boost={item.boost} className="max-w-sm" />

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={open}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
            >
              <LineChart className="h-3.5 w-3.5" aria-hidden />
              {item.contract ? 'Ver gráfico y comprar' : 'Ver proyecto'}
            </button>
            <BoostButton
              target={{ type: item.kind, id: item.id, name: item.label, image: item.image }}
              boost={item.boost}
            />
          </div>
        </div>

        {/* Gráfico en vivo, si el token ya existe on-chain */}
        {item.contract && (
          <div className="w-full shrink-0 lg:w-[46%]">
            <LiveChart network={item.network} contract={item.contract} height={240} />
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * La cinta de boosts: pasa por arriba en todas las pestañas con los proyectos
 * que tienen munición viva y cuántas balas les quedan. Es lo que de verdad
 * compra quien dispara, porque la ve todo el que entra, esté donde esté.
 */
export function BoostTicker() {
  const items = useBoostedItems()
  if (items.length === 0) return null
  // Duplicada para que el bucle no tenga costura (ver .animate-ticker)
  const loop = [...items, ...items]
  // Segundos por proyecto, para que la velocidad no dependa de cuántos haya
  const duration = Math.max(items.length, 3) * 7

  return (
    <div className="relative flex w-full items-center overflow-hidden border-b border-amber-400/20 bg-gradient-to-r from-amber-400/[0.07] via-transparent to-amber-400/[0.07]">
      <span className="z-10 flex shrink-0 items-center gap-1.5 border-r border-amber-400/20 bg-[#0d0e0a] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
        <Bomb className="h-3 w-3" strokeWidth={3} aria-hidden /> En la mira
      </span>
      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        <div className="animate-ticker flex w-max items-center gap-6 px-4" style={{ animationDuration: `${duration}s` }}>
          {loop.map((item, i) => (
            // La segunda vuelta es la misma lista: fuera del foco y del lector
            <BoostTickerItem key={`${item.key}-${i}`} item={item} duplicate={i >= items.length} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BoostTickerItem({ item, duplicate }: { item: BoostedItem; duplicate: boolean }) {
  const { openLaunch, openToken } = useUI()
  return (
    <button
      onClick={() => (item.kind === 'launch' ? openLaunch(item.id) : openToken(item.id))}
      aria-hidden={duplicate}
      tabIndex={duplicate ? -1 : 0}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap py-1.5 text-[11px] transition-opacity hover:opacity-80"
    >
      <TokenGlyph src={item.image} ticker={item.label} size="xs" className="h-5 w-5 rounded-full text-[8px]" />
      <span className={cn('font-bold', item.boost.golden ? 'text-amber-200' : 'text-foreground/90')}>{item.label}</span>
      <span
        className={cn(
          'flex items-center gap-1 rounded-full px-1.5 font-black tabular-nums',
          item.boost.golden ? 'bg-amber-300/20 text-amber-200' : 'bg-amber-400/12 text-amber-300'
        )}
      >
        <Bomb className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
        {fmtBullets(item.boost.bullets)}
      </span>
      {item.token && (
        <span className={cn(item.token.change24h >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
          {fmtPct(item.token.change24h)}
        </span>
      )}
    </button>
  )
}
