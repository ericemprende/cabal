import { DEFAULT_CHARACTERS } from '@/lib/guide-characters'

/**
 * Foto de perfil por defecto: a quien no ha subido ninguna se le asigna un
 * personaje del escuadrón sobre un color de la marca.
 *
 * No es aleatorio de verdad: sale de un hash del handle, así que a la misma
 * persona le toca siempre el mismo. Si fuera aleatorio en cada render, el
 * avatar bailaría entre el servidor y el navegador, y de una pantalla a otra.
 *
 * En cuanto sube su foto, esto desaparece: es un punto de partida, no una
 * decisión permanente.
 */

/**
 * Doce fondos de la paleta de Cabal. Están elegidos para que el uniforme de
 * camuflaje —verde oliva y negro— se recorte encima sin mezclarse: nada de
 * verdes medios, que es justo donde el personaje desaparecería.
 */
export const AVATAR_COLORS = [
  '#4A5D23', // Oliva profundo
  '#C9D97A', // Verde pálido
  '#E0A32E', // Ámbar
  '#D4713A', // Naranja quemado
  '#A8442A', // Óxido
  '#7A3B6E', // Ciruela
  '#3D5A8A', // Azul cadete
  '#2F7D75', // Verde azulado
  '#8C2F39', // Granate
  '#5B6670', // Gris acero
  '#B5883C', // Caqui dorado
  '#2B2F1E', // Verde noche
] as const

/** FNV-1a: corto, estable y sin dependencias. Mismo texto, mismo número. */
function hash(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface DefaultAvatar {
  /** Id del personaje (icecomms, catintel…). */
  characterId: string
  /** Miniatura de 128px: es lo que se ve en un avatar. */
  image: string
  /** Fondo, de la paleta de arriba. */
  color: string
}

/**
 * Qué personaje y qué color le tocan a alguien. La semilla es su handle; si
 * no lo hay todavía (un registro a medias), vale el nombre o el id.
 *
 * El personaje y el color se sacan de dos partes distintas del hash para que
 * no vayan siempre emparejados: doce colores por diez personajes dan ciento
 * veinte combinaciones, suficiente para que dos vecinos en una lista no se
 * confundan.
 */
export function defaultAvatarFor(seed: string | null | undefined): DefaultAvatar {
  const key = (seed ?? '').trim().toLowerCase() || 'cabal'
  const h = hash(key)
  const character = DEFAULT_CHARACTERS[h % DEFAULT_CHARACTERS.length]
  const color = AVATAR_COLORS[(h >>> 8) % AVATAR_COLORS.length]
  return {
    characterId: character.id,
    image: `/guide/${character.id}-sm.webp`,
    color,
  }
}
