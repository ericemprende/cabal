import { CABAL_X_HANDLE, CABAL_X_URL, followIntentUrl } from '@/lib/cabal-x'
import { db } from '@/lib/db'
import { DEFAULT_LOCALE, toLocale, type Locale } from '@/lib/share-card'
import { siteUrl } from '@/lib/waitlist'

// Se reexportan para que el resto del servidor tenga una sola puerta de entrada
// a la campaña; el cliente los toma de '@/lib/cabal-x'.
export { CABAL_X_HANDLE, CABAL_X_URL, followIntentUrl }

/**
 * Campaña "sigue a @Cabal_app".
 *
 * Dos bonus encadenados, cada uno una sola vez por cuenta:
 *   1. Seguir la cuenta oficial en X ............ FOLLOW_BONUS (15)
 *   2. Publicar la tarjeta de "ya la sigo" ...... FOLLOW_SHARE_BONUS (10)
 *
 * El primero solo se abona hasta la fecha límite de la campaña; el segundo
 * acompaña siempre al primero, así que tampoco se puede cobrar después.
 *
 * Importante: NO comprobamos de verdad que la persona siga la cuenta. La API de
 * X necesita el scope `follows.read` (el nuestro es `users.read tweet.read
 * offline.access`, ver oauth.ts) y el endpoint de "a quién sigue" está fuera del
 * plan gratuito. Se abona por confianza al abrir el intent de seguir, igual que
 * el bonus de compartir de la lista de espera, que también puntúa por abrir el
 * compositor. Si algún día se paga la API, el sitio donde verificar es
 * `claimFollow`, y nada más cambia.
 */

/** Puntos por seguir la cuenta antes de la fecha límite. */
export const FOLLOW_BONUS = 15
/** Puntos extra por publicar la tarjeta de "sigo a Cabal". */
export const FOLLOW_SHARE_BONUS = 10

/**
 * Fin de la campaña. En UTC a propósito: es la única lectura que no depende de
 * dónde esté el servidor ni el usuario, y el aviso de la interfaz dice la fecha,
 * no la hora. Editable desde el panel admin con la Setting `follow_x_deadline`.
 */
export const FOLLOW_DEADLINE_DEFAULT = '2026-09-30T23:59:59.999Z'

/** Motivo de los PointEvent de esta campaña. */
export type FollowStep = 'follow' | 'share'

/** Motivo tal y como se guarda en PointEvent.reason. */
export type FollowReason = 'follow_x' | 'share_follow_x'

const REASONS: Record<FollowStep, FollowReason> = {
  follow: 'follow_x',
  share: 'share_follow_x',
}

export function followReason(step: FollowStep): FollowReason {
  return REASONS[step]
}

// ---------- Ajustes editables ----------
/**
 * Lee una Setting numérica y la crea con su default si no existe. Las bases de
 * datos anteriores a esta campaña no la traen sembrada, y sin esto la regla
 * ausente valdría 0 y no se darían puntos (ya pasó con points_launch).
 */
async function numericSetting(key: string, fallback: number): Promise<number> {
  const existing = await db.setting.findUnique({ where: { key } })
  if (existing) return parseInt(existing.value, 10) || 0
  await db.setting.create({ data: { key, value: String(fallback) } }).catch(() => {})
  return fallback
}

export function followRuleAmount(): Promise<number> {
  return numericSetting('points_follow_x', FOLLOW_BONUS)
}

export function followShareRuleAmount(): Promise<number> {
  return numericSetting('points_share_follow_x', FOLLOW_SHARE_BONUS)
}

/** Fecha de cierre vigente. Un valor corrupto en la Setting cae en el default. */
export async function followDeadline(): Promise<Date> {
  const existing = await db.setting.findUnique({ where: { key: 'follow_x_deadline' } })
  if (!existing) {
    await db.setting
      .create({ data: { key: 'follow_x_deadline', value: FOLLOW_DEADLINE_DEFAULT } })
      .catch(() => {})
    return new Date(FOLLOW_DEADLINE_DEFAULT)
  }
  const parsed = new Date(existing.value)
  return Number.isNaN(parsed.getTime()) ? new Date(FOLLOW_DEADLINE_DEFAULT) : parsed
}

/** ¿Sigue abierta la campaña? */
export async function followCampaignOpen(now: Date = new Date()): Promise<boolean> {
  return now.getTime() <= (await followDeadline()).getTime()
}

// ---------- Enlaces ----------
/**
 * Enlace que acompaña al post de "ya sigo a Cabal": /f/<handle> (y /f/<handle>/en).
 *
 * Es una ruta propia y no /r/<handle> porque la tarjeta Open Graph es distinta,
 * y X guarda una sola tarjeta por URL. Quien entra por aquí queda igualmente
 * registrado como invitado de <handle>: /f sirve la misma landing que /r.
 *
 * El idioma va en la ruta, no en la query, por lo mismo que en shareRefUrl: X
 * normaliza las URLs y descarta los parámetros que trata como seguimiento.
 */
export function followRefUrl(handle?: string | null, locale: Locale = DEFAULT_LOCALE): string {
  if (!handle) return siteUrl()
  const l = toLocale(locale)
  const base = `${siteUrl()}/f/${encodeURIComponent(handle)}`
  return l === DEFAULT_LOCALE ? base : `${base}/${l}`
}

/** Imagen Open Graph de ese enlace: /api/follow/card/<handle>.<idioma>.jpg */
export function followCardUrl(handle: string, locale: Locale = DEFAULT_LOCALE): string {
  return `${siteUrl()}/api/follow/card/${encodeURIComponent(handle)}.${toLocale(locale)}.jpg`
}

// ---------- Texto del post ----------
export const FOLLOW_SHARE_TEXT: Record<Locale, string> = {
  es: [
    `Ya sigo a @${CABAL_X_HANDLE} 🐺 El radar donde la comunidad ve los memecoins ANTES de que salgan.`,
    '',
    'Síguela tú también y entra conmigo al escuadrón:',
  ].join('\n'),
  en: [
    `Now following @${CABAL_X_HANDLE} 🐺 The radar where the community spots memecoins BEFORE they launch.`,
    '',
    'Follow it too and join the squad with me:',
  ].join('\n'),
}

export function followShareText(locale: Locale = DEFAULT_LOCALE): string {
  return FOLLOW_SHARE_TEXT[toLocale(locale)]
}

/** Intent de publicación con el texto y el enlace ya rellenados. */
export function followShareIntentUrl(
  handle?: string | null,
  locale: Locale = DEFAULT_LOCALE
): string {
  const params = new URLSearchParams({
    text: followShareText(locale),
    url: followRefUrl(handle, locale),
  })
  return `https://x.com/intent/post?${params.toString()}`
}

/** El post de la campaña en un idioma concreto. */
export type FollowShareVariant = {
  text: string
  url: string
  intent: string
  card: string
}

export function followVariants(handle?: string | null): Record<Locale, FollowShareVariant> {
  const build = (locale: Locale): FollowShareVariant => ({
    text: followShareText(locale),
    url: followRefUrl(handle, locale),
    intent: followShareIntentUrl(handle, locale),
    card: handle ? followCardUrl(handle, locale) : `${siteUrl()}/og-cabal.png`,
  })
  return { es: build('es'), en: build('en') }
}

/** Lo que la interfaz necesita para pintar la campaña. */
export type FollowStatusDTO = {
  /** @usuario de Cabal de quien mira, para componer su tarjeta. */
  handle: string
  /** Cuenta oficial y enlace directo a ella. */
  account: { handle: string; url: string; intent: string }
  locale: Locale
  share: Record<Locale, FollowShareVariant>
  /** Puntos de cada paso, según las reglas vigentes. */
  bonus: { follow: number; share: number }
  /** Pasos ya cobrados por esta cuenta. */
  claimed: { follow: boolean; share: boolean }
  /** Cierre de la campaña en ISO, y si todavía está abierta. */
  deadline: string
  open: boolean
}
