/**
 * Reputación de un usuario: la comunidad le da 👍 ("confío") o 👎 ("no
 * confío"), con una reseña corta opcional. Sirve sobre todo para el dev de un
 * launch: el fueguito mide las ganas que hay por un proyecto, esto mide la
 * confianza que se le tiene a la persona que lo publica.
 *
 * Módulo puro (sin acceso a la BD) para poder usarlo igual en el servidor,
 * donde se calcula, y en el cliente, donde se pinta.
 */

/** Valor de un voto. 0 no se guarda: significa retirar el voto. */
export type RepValue = 1 | -1

/**
 * Votos mínimos para enseñar el porcentaje. Por debajo solo se enseñan los
 * votos en crudo: "confiable al 100%" con un solo voto no informa de nada y
 * es justo lo que intentaría fabricar un scammer con dos cuentas.
 */
export const REP_MIN_VOTES = 3

/**
 * Suavizado bayesiano: el porcentaje arranca en 50 y se va acercando a la
 * proporción real conforme llegan votos. Equivale a añadirle a todo el mundo
 * REP_SMOOTHING votos neutros de regalo, así que 3 de 3 positivos dan 79% y no
 * 100%, y hacen falta decenas de votos para pasar de "Confiable".
 */
const REP_SMOOTHING = 4

/**
 * Peso del voto de quien califica. Una cuenta recién hecha vale 1; verificarse
 * y tener recorrido en el Cabal suben el peso hasta 4. Encarece la granja de
 * votos sin cerrarle la puerta a nadie.
 */
export function repWeight(voter: {
  walletVerified: boolean
  xVerified: boolean
  emailVerified?: boolean | null
  cabalScore: number
}): number {
  let w = 1
  if (voter.walletVerified) w += 1
  if (voter.xVerified) w += 1
  if (voter.cabalScore >= 100) w += 1
  return Math.min(w, 4)
}

/** Porcentaje de confianza (0-100) a partir de los votos ya ponderados. */
export function repScore(weightUp: number, weightDown: number): number {
  const total = weightUp + weightDown
  if (total <= 0) return 50
  return Math.round((100 * (weightUp + REP_SMOOTHING * 0.5)) / (total + REP_SMOOTHING))
}

export type RepTone = 'great' | 'good' | 'mixed' | 'poor' | 'bad' | 'none'

export type RepLabel = {
  text: string
  tone: RepTone
  /** Frase larga para el tooltip/aria. */
  hint: string
}

/** Etiqueta que acompaña al porcentaje. `votes` es el número de votos, sin ponderar. */
export function repLabel(score: number, votes: number): RepLabel {
  if (votes < REP_MIN_VOTES) {
    return {
      text: 'Sin valoraciones',
      tone: 'none',
      hint: `Necesita ${REP_MIN_VOTES} valoraciones para tener reputación`,
    }
  }
  if (score >= 85) return { text: 'Muy confiable', tone: 'great', hint: 'La comunidad confía en esta persona' }
  if (score >= 70) return { text: 'Confiable', tone: 'good', hint: 'Buena reputación en el Cabal' }
  if (score >= 45) return { text: 'Mixto', tone: 'mixed', hint: 'Opiniones divididas: lee las reseñas' }
  if (score >= 25) return { text: 'Dudoso', tone: 'poor', hint: 'Más votos negativos que positivos' }
  return { text: 'Riesgo alto', tone: 'bad', hint: 'La comunidad desconfía de esta persona: investiga antes de entrar' }
}

/** Clases de color por tono, para no repetirlas en cada componente. */
export const REP_TONE_CLASS: Record<RepTone, { text: string; bg: string; border: string; bar: string }> = {
  great: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/40', bar: 'bg-emerald-400' },
  good: { text: 'text-primary', bg: 'bg-[#8FA83F]/10', border: 'border-[#8FA83F]/40', bar: 'bg-primary' },
  mixed: { text: 'text-amber-300', bg: 'bg-amber-300/10', border: 'border-amber-300/40', bar: 'bg-amber-300' },
  poor: { text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/40', bar: 'bg-orange-400' },
  bad: { text: 'text-[#ff8080]', bg: 'bg-[#ff8080]/10', border: 'border-[#ff8080]/40', bar: 'bg-[#ff8080]' },
  none: { text: 'text-muted-foreground', bg: 'bg-white/5', border: 'border-white/10', bar: 'bg-white/20' },
}

/** Largo máximo de la reseña escrita. */
export const REP_BODY_MAX = 280
