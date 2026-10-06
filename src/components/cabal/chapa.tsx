import { cn } from '@/lib/utils'
import { SILUETAS, type Silueta } from '@/lib/siluetas'

/**
 * Chapa: una silueta militar sobre una placa octogonal con bisel, remaches y
 * sombra. Es la pieza de la que sale toda la iconografía de Cabal, incluida la
 * forma de los botones.
 *
 * El metal dice el nivel cuando se usa como insignia (bronce → obsidiana) y es
 * fijo cuando solo distingue una acción de otra. Los remaches encendidos
 * repiten ese nivel sin depender del color, que bronce y oro se parecen
 * bastante si no distingues el rojo del verde.
 *
 * Dos modos, decididos por el tamaño: con placa de 44px para arriba, silueta
 * sola por debajo, porque a 22px el octógono se cierra y tapa el dibujo.
 */
export type Metal = 'bronce' | 'acero' | 'oro' | 'obsidiana' | 'verde' | 'fundador' | 'blanco'

/** Los degradados viven una sola vez en el layout: ChapaDefs. */
const CARA: Record<Metal, [string, string, string]> = {
  bronce: ['#f6ddbb', '#c8823c', '#7a4718'],
  acero: ['#ffffff', '#c3cad2', '#6d7783'],
  oro: ['#fff4cf', '#fcd34d', '#a1741a'],
  obsidiana: ['#ffffff', '#cdd6ff', '#4a3f7a'],
  verde: ['#eaf7c0', '#8FA83F', '#46571f'],
  fundador: ['#eaf7c0', '#8FA83F', '#46571f'],
  // Donador: blanco perla, que no se confunda con el acero
  blanco: ['#ffffff', '#f4f1ea', '#b9b3a6'],
}

const PLACA: Record<Metal, [string, string, string]> = {
  bronce: ['#3a2415', '#22150c', '#100a05'],
  acero: ['#2b3138', '#191d22', '#0b0d10'],
  oro: ['#3a3018', '#241d0e', '#120e06'],
  obsidiana: ['#1c1d2a', '#0d0e16', '#050509'],
  verde: ['#2c3420', '#1a2013', '#0d1009'],
  fundador: ['#2c3420', '#1a2013', '#0d1009'],
  blanco: ['#34322e', '#1f1e1b', '#0e0d0c'],
}

const REMACHE: Record<Metal, string> = {
  bronce: '#c8823c',
  acero: '#c3cad2',
  oro: '#fcd34d',
  obsidiana: '#b9c4ff',
  verde: '#8FA83F',
  fundador: '#8FA83F',
  blanco: '#ffffff',
}

const METALES = Object.keys(CARA) as Metal[]
const OCTOGONO = 'M150 16h212l134 134v212L362 496H150L16 362V150z'
const LUZ = 'M150 16h212l134 134v56L362 72H150L16 206v-56z'

/**
 * Los degradados de todas las chapas, una sola vez por página. Va en el layout;
 * si se repitiera en cada icono, una lista de cien insignias arrastraría cien
 * copias de lo mismo.
 */
export function ChapaDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        {METALES.map((m) => (
          <linearGradient key={`cara-${m}`} id={`cabal-cara-${m}`} x1="0" y1="0" x2=".3" y2="1">
            <stop offset="0" stopColor={CARA[m][0]} />
            <stop offset=".42" stopColor={CARA[m][1]} />
            <stop offset="1" stopColor={CARA[m][2]} />
          </linearGradient>
        ))}
        {METALES.map((m) => (
          <linearGradient key={`placa-${m}`} id={`cabal-placa-${m}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PLACA[m][0]} />
            <stop offset=".55" stopColor={PLACA[m][1]} />
            <stop offset="1" stopColor={PLACA[m][2]} />
          </linearGradient>
        ))}
        <linearGradient id="cabal-brillo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".45" />
          <stop offset=".38" stopColor="#ffffff" stopOpacity=".05" />
          <stop offset=".39" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity=".18" />
        </linearGradient>
        <linearGradient id="cabal-borde" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".34" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".06" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Chapa({
  silueta,
  metal = 'verde',
  rango = 0,
  placa = false,
  className,
  title,
}: {
  silueta: Silueta
  metal?: Metal
  /** 1 a 4: cuántos remaches se encienden. 0 los deja todos apagados. */
  rango?: number
  /** La placa solo se dibuja de 44px para arriba; por debajo estorba. */
  placa?: boolean
  className?: string
  title?: string
}) {
  const d = SILUETAS[silueta]
  if (!placa) {
    return (
      <svg viewBox="0 0 512 512" className={cn('shrink-0', className)} aria-hidden={!title} role={title ? 'img' : undefined}>
        {title && <title>{title}</title>}
        <path d={d} fill={`url(#cabal-cara-${metal})`} />
      </svg>
    )
  }
  const remaches: [number, number][] = [
    [64, 448],
    [448, 448],
    [448, 64],
    [64, 64],
  ]
  return (
    <svg viewBox="0 0 512 512" className={cn('shrink-0', className)} aria-hidden={!title} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path
        d={OCTOGONO}
        fill={`url(#cabal-placa-${metal})`}
        stroke={metal === 'fundador' ? '#8FA83F' : metal === 'obsidiana' ? '#b9c4ff' : 'url(#cabal-borde)'}
        strokeOpacity={metal === 'fundador' ? 0.75 : metal === 'obsidiana' ? 0.45 : 1}
        strokeWidth={metal === 'fundador' ? 12 : 10}
      />
      <path d={LUZ} fill="#ffffff" opacity={metal === 'obsidiana' ? 0.07 : 0.055} />
      {/* El aro interior es solo de Fundador: no hay ninguna otra chapa con él */}
      {metal === 'fundador' && (
        <path d="M150 38h212l122 122v192L362 474H150L28 352V160z" fill="none" stroke="#8FA83F" strokeOpacity=".35" strokeWidth="5" />
      )}
      <g transform="translate(112 104) scale(0.5625)">
        <path d={d} fill="#05060a" opacity=".5" transform="translate(0 26)" />
        <path d={d} fill={`url(#cabal-cara-${metal})`} />
        <path d={d} fill="url(#cabal-brillo)" />
      </g>
      <g>
        {remaches.map(([cx, cy], i) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={i < rango ? 11 : 8}
            fill={i < rango ? REMACHE[metal] : '#ffffff'}
            opacity={i < rango ? 0.95 : 0.12}
          />
        ))}
      </g>
    </svg>
  )
}
