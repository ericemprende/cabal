'use client'

import { useState } from 'react'
import { Bomb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAmmoInfo } from '@/lib/api-client'
import { useUI, type AmmoTarget } from '@/lib/store'
import { UserAvatar, useNow } from '@/components/cabal/shared'
import type { BoostScoreDTO } from '@/lib/types'

/**
 * Las piezas sueltas del sistema de munición: la bala, la insignia de la
 * cabecera y el contador que llevan los proyectos boosteados. El diálogo de
 * compra y disparo vive en ammo-dialog.tsx.
 */

/** Una bala de fusil, de perfil. Hereda el color del texto. */
export function Bullet({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 8 20" fill="none" className={cn('h-4 w-[7px]', className)} style={style} aria-hidden>
      {/* Punta */}
      <path d="M4 0C4 0 6.6 2.6 6.6 6H1.4C1.4 2.6 4 0 4 0Z" fill="currentColor" />
      {/* Cuello */}
      <rect x="1.4" y="6" width="5.2" height="1.6" fill="currentColor" opacity="0.55" />
      {/* Vaina */}
      <rect x="0.9" y="7.6" width="6.2" height="11" rx="0.8" fill="currentColor" opacity="0.85" />
      {/* Culote */}
      <rect x="0.4" y="18.2" width="7.2" height="1.6" rx="0.6" fill="currentColor" />
    </svg>
  )
}

/** Balas en fila, como un peine cargado. Se llenan una detrás de otra. */
export function BulletRow({
  count,
  max = 12,
  animated = true,
  className,
}: {
  count: number
  max?: number
  animated?: boolean
  className?: string
}) {
  const shown = Math.max(0, Math.min(max, count))
  return (
    <span className={cn('flex items-end gap-[2px]', className)} aria-hidden>
      {[...Array(max)].map((_, i) => (
        <Bullet
          key={i}
          className={cn(
            'transition-opacity',
            i < shown ? 'text-amber-300' : 'text-white/12',
            animated && i < shown && 'animate-ammo-load'
          )}
          {...(animated && i < shown ? { style: { animationDelay: `${i * 35}ms` } } : {})}
        />
      ))}
    </span>
  )
}

/** 1.440 → "1.440" · 12.500 → "12,5K": el contador no puede romper la fila. */
export function fmtBullets(n: number): string {
  if (n < 10_000) return n.toLocaleString('es')
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace('.', ',')}K`
  return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
}

/** Balas → "2 h 24 min", que es lo que de verdad le importa a quien compra. */
export function bulletsAsTime(bullets: number): string {
  if (bullets < 60) return `${bullets} min`
  const days = Math.floor(bullets / 1440)
  const hours = Math.floor((bullets % 1440) / 60)
  const mins = bullets % 60
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`
}

/**
 * Contador de munición viva de un proyecto: va en su tarjeta, en el ticker y
 * en su ficha. Dorado cuando el proyecto pasó el umbral.
 */
export function BoostCounter({
  boost,
  size = 'sm',
  className,
}: {
  boost: BoostScoreDTO
  size?: 'xs' | 'sm'
  className?: string
}) {
  // El número baja solo: una bala cada minuto, sin volver a pedir nada.
  const now = useNow(30_000)
  const left = Math.max(0, Math.ceil((new Date(boost.endsAt).getTime() - now) / 60_000))
  const bullets = Math.min(boost.bullets, left === 0 ? 0 : boost.bullets)
  if (bullets <= 0) return null
  return (
    <span
      title={`${bullets.toLocaleString('es')} balas activas · ${bulletsAsTime(bullets)} destacado${
        boost.shooters > 1 ? ` · ${boost.shooters} personas disparando` : ''
      }`}
      className={cn(
        'relative inline-flex shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-full border font-black tabular-nums',
        size === 'xs' ? 'px-1.5 py-px text-[9px]' : 'px-2 py-0.5 text-[10px]',
        boost.golden
          ? 'border-amber-300/60 bg-gradient-to-r from-amber-400/25 to-amber-200/10 text-amber-200'
          : 'border-amber-400/35 bg-amber-400/10 text-amber-300',
        className
      )}
    >
      {boost.golden && (
        <span className="pointer-events-none absolute inset-y-0 w-6 animate-ammo-shine bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      )}
      <Bullet className={size === 'xs' ? 'h-2.5 w-[5px]' : 'h-3 w-[6px]'} />
      {fmtBullets(bullets)}
    </span>
  )
}

/**
 * Insignia de la cabecera: la granada con el saldo de balas. Abre el diálogo
 * de munición y pega un culatazo cada vez que el saldo cambia.
 */
export function AmmoBadge({ className }: { className?: string }) {
  const { openAmmo } = useUI()
  const { data } = useAmmoInfo()
  const balance = data?.balance ?? 0

  // Culatazo cuando el saldo cambia (compró balas, disparó). Se arma durante
  // el render comparando con el saldo anterior y se desarma cuando la
  // animación termina: sin efectos ni temporizadores.
  const [seenBalance, setSeenBalance] = useState(balance)
  const [recoil, setRecoil] = useState(false)
  if (seenBalance !== balance) {
    setSeenBalance(balance)
    setRecoil(true)
  }

  return (
    <button
      onClick={() => openAmmo()}
      aria-label={balance > 0 ? `Munición: ${balance} balas` : 'Conseguir munición'}
      title={
        balance > 0
          ? `${balance.toLocaleString('es')} balas · ${bulletsAsTime(balance)} de proyecto destacado`
          : 'Consigue munición y destaca tu proyecto en el Radar'
      }
      className={cn(
        'group relative flex shrink-0 items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-black tabular-nums text-amber-300 transition-all hover:border-amber-300/70 hover:bg-amber-400/20 active:scale-95',
        balance > 0 && 'animate-ammo-pulse',
        className
      )}
    >
      {/* El culatazo va dentro: dos animate-* en el mismo elemento se pisan,
          porque las dos escriben la misma propiedad `animation`. */}
      <span
        className={cn('flex items-center gap-1.5', recoil && 'animate-ammo-recoil')}
        onAnimationEnd={() => setRecoil(false)}
      >
        <Bomb className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        {balance > 0 ? fmtBullets(balance) : 'MUNICIÓN'}
      </span>
    </button>
  )
}

/**
 * Botón para disparar munición sobre un proyecto, con su objetivo ya cargado.
 * Va en la ficha del launch y en la del token.
 */
export function BoostButton({
  target,
  boost,
  className,
}: {
  target: AmmoTarget
  boost?: BoostScoreDTO | null
  className?: string
}) {
  const { openAmmo } = useUI()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        openAmmo(target)
      }}
      className={cn(
        'group relative flex items-center gap-1.5 overflow-hidden rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-400/20 to-amber-400/5 px-3 py-1.5 text-xs font-bold text-amber-300 transition-all hover:border-amber-300/70 hover:from-amber-400/30 active:scale-95',
        className
      )}
    >
      <Bomb className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      {boost && boost.bullets > 0 ? (
        <>
          Sumar balas
          <span className="rounded-full bg-amber-400/20 px-1.5 font-mono text-[10px]">{fmtBullets(boost.bullets)}</span>
        </>
      ) : (
        'Destacar con munición'
      )}
    </button>
  )
}

/**
 * El cargador de un proyecto: se vacía solo según se van gastando las balas y
 * se rellena de golpe cuando alguien recarga, con fogonazo y la cara de quien
 * lo hizo.
 *
 * Lo lleno que está sale de comparar lo que queda con todo lo que se ha metido
 * (`lifetime`), así que una recarga se ve de verdad: las balas vuelven a
 * subir en vez de seguir bajando.
 */
export function Magazine({
  boost,
  slots = 18,
  className,
}: {
  boost: BoostScoreDTO
  slots?: number
  className?: string
}) {
  // Una bala por minuto: el cargador baja solo, sin volver a pedir nada.
  const now = useNow(30_000)
  const left = Math.max(0, Math.ceil((new Date(boost.endsAt).getTime() - now) / 60_000))
  const bullets = Math.min(boost.bullets, left === 0 ? 0 : boost.bullets)
  const ratio = bullets / Math.max(boost.lifetime, bullets, 1)
  // Mientras quede una bala se ve al menos una: un cargador vacío diría que el
  // boost se apagó, y no es verdad hasta que llega a cero.
  const filled = bullets > 0 ? Math.max(1, Math.min(slots, Math.round(ratio * slots))) : 0

  // Fogonazo cuando entra munición nueva. Se arma durante el render comparando
  // con el último disparo que vimos y se desarma al acabar la animación.
  const [seenShot, setSeenShot] = useState(boost.lastShotAt)
  const [reloading, setReloading] = useState(false)
  if (seenShot !== boost.lastShotAt) {
    setSeenShot(boost.lastShotAt)
    setReloading(true)
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-400/25 bg-black/30 px-2.5 py-2',
        reloading && 'animate-ammo-reload-flash',
        className
      )}
      // Las animaciones de los hijos burbujean: sin esto, la entrada del avatar
      // cortaría el fogonazo a la mitad.
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setReloading(false)
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex items-end gap-[2px]"
          role="img"
          aria-label={`Cargador: ${bullets.toLocaleString('es')} balas de ${boost.lifetime.toLocaleString('es')}`}
        >
          {[...Array(slots)].map((_, i) => (
            <Bullet
              key={i}
              className={cn(
                'h-4 w-[7px] transition-colors duration-500',
                i < filled ? 'text-amber-300' : 'text-white/10',
                // La última que queda parpadea: es la que se está gastando
                i === filled - 1 && 'animate-ammo-draining'
              )}
            />
          ))}
        </span>
        <span className="ml-auto shrink-0 font-mono text-sm font-bold tabular-nums text-amber-300">
          {fmtBullets(bullets)}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        {boost.lastShooter ? (
          // La clave es la hora del disparo: cada recarga remonta la fila y la
          // cara vuelve a entrar de golpe.
          <span key={boost.lastShotAt} className="animate-ammo-pop-in flex min-w-0 items-center gap-1.5">
            <UserAvatar
              name={boost.lastShooter.name}
              handle={boost.lastShooter.handle}
              src={boost.lastShooter.avatar}
              size="xs"
            />
            <span className="min-w-0 truncate text-[11px] text-foreground/85">
              <span className="font-bold text-amber-200">@{boost.lastShooter.handle}</span> recargó
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Sin recargas todavía</span>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{bulletsAsTime(bullets)}</span>
      </div>
    </div>
  )
}
