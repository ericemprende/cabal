import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import {
  CARD_COUNT,
  DEFAULT_LOCALE,
  SHARE_BODY,
  SHARE_PHRASES,
  pickIndex,
  toLocale,
  type Locale,
} from '@/lib/share-card'

export type { Locale }
export { DEFAULT_LOCALE, toLocale }

/**
 * Lista de espera (whitelist) previa al lanzamiento público.
 *
 * Flujo: home (/) → /api/waitlist/x/start → X (OAuth 2.0 + PKCE) →
 * /api/waitlist/x/callback → alta en WaitlistEntry + cuenta Cabal + cookie
 * firmada `cabal_wl` con el id de la entrada, para que la landing pueda
 * mostrar el estado y el botón de compartir sin volver a pasar por X.
 *
 * El admin habilita entradas manualmente desde el panel (pestaña Whitelist).
 */

// ---------- Cookie de la entrada ----------
export const WAITLIST_COOKIE = 'cabal_wl'
const TTL_S = 60 * 60 * 24 * 90 // 90 días

function secret(): string {
  return process.env.AUTH_SECRET || 'cabal-waitlist-secret-v1'
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url')
}

export function createWaitlistCookie(entryId: string): string {
  return `${entryId}.${sign(entryId)}`
}

export function readWaitlistCookie(token: string | null | undefined): string | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const id = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(id)
  if (expected.length !== sig.length) return null
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) ? id : null
  } catch {
    return null
  }
}

export function waitlistCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: TTL_S, secure }
}

// ---------- Contenido del post que se comparte en X ----------
/** Dominio público del proyecto. Configurable por si cambia el entorno. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://cabal.army').replace(/\/+$/, '')
}

/** Puntos que gana el usuario por compartir su tarjeta en X (una sola vez). */
export const SHARE_BONUS = 10

/**
 * Idioma preferido del visitante a partir de la cabecera Accept-Language.
 * Es más fiable que geolocalizar la IP: refleja el idioma que la persona ha
 * elegido en su sistema, no el país desde el que se conecta (un hispanohablante
 * de viaje, o detrás de una VPN, sigue viendo español).
 */
export function localeFromHeader(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  // "es-ES,es;q=0.9,en;q=0.8" → la primera etiqueta que reconozcamos gana,
  // respetando el orden de preferencia declarado por el navegador.
  const tags = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((x) => x.trim().startsWith('q='))
      return { tag: tag.trim().toLowerCase(), q: q ? parseFloat(q.split('=')[1]) || 0 : 1 }
    })
    .sort((a, b) => b.q - a.q)

  for (const { tag } of tags) {
    const base = tag.slice(0, 2)
    if (base === 'es') return 'es'
    if (base === 'en') return 'en'
  }
  return DEFAULT_LOCALE
}

/**
 * Texto del post. La frase de cabecera se elige de forma estable por usuario
 * (misma persona → misma frase, y coincide con la plantilla de su tarjeta).
 */
export function shareText(seed?: string | null, locale: Locale = DEFAULT_LOCALE): string {
  const l = toLocale(locale)
  const phrases = SHARE_PHRASES[l]
  const phrase = seed ? phrases[pickIndex(seed, CARD_COUNT)] : phrases[0]
  return [phrase, ...SHARE_BODY[l]].join('\n\n')
}

/**
 * URL pública del enlace de referido. Lleva el idioma (`l`) además del handle
 * porque el `og:image` lo pide el rastreador de X desde sus propios servidores:
 * el idioma tiene que viajar en el enlace, no detectarse en ese momento.
 *
 * El idioma se escribe SIEMPRE, incluso en español que es el valor por defecto.
 * X cachea la tarjeta de cada URL cerca de una semana y retiró en 2022 el
 * validador que permitía refrescarla a mano, así que la única forma de que
 * vuelva a rastrear un enlace ya visto es que la URL cambie. Los enlaces que
 * se compartieron antes de tener metadatos quedaron cacheados sin imagen; con
 * el parámetro presente son URLs nuevas y X las rastrea otra vez.
 */
export function shareRefUrl(handle?: string | null, locale: Locale = DEFAULT_LOCALE): string {
  if (!handle) return siteUrl()
  const params = new URLSearchParams({ ref: handle, l: toLocale(locale) })
  return `${siteUrl()}/?${params.toString()}`
}

/**
 * URL del intent de X con el texto y el enlace de referido ya rellenados.
 * El enlace lleva ?ref=<handle>: quien entre por ahí queda registrado como
 * invitado suyo y le genera el 10% de sus puntos.
 */
export function shareIntentUrl(
  handle?: string | null,
  seed?: string | null,
  locale: Locale = DEFAULT_LOCALE
): string {
  const params = new URLSearchParams({
    text: shareText(seed ?? handle, locale),
    url: shareRefUrl(handle, locale),
  })
  return `https://x.com/intent/post?${params.toString()}`
}

/**
 * Puntos configurados para el bonus por compartir. La regla vive en Setting
 * (editable desde el panel admin); si aún no existe se crea con el default,
 * porque las bases de datos anteriores a esta función no la traen sembrada.
 */
export async function shareRuleAmount(): Promise<number> {
  const existing = await db.setting.findUnique({ where: { key: 'points_share_x' } })
  if (existing) return parseInt(existing.value, 10) || 0
  await db.setting
    .create({ data: { key: 'points_share_x', value: String(SHARE_BONUS) } })
    .catch(() => {}) // carrera con otra petición: da igual quién la cree
  return SHARE_BONUS
}

/**
 * URL pública de la tarjeta personalizada (og:image del enlace de referido).
 * Como en `shareRefUrl`, el idioma va siempre explícito: además de elegir la
 * plantilla, hace que sea una URL nueva para X y no reutilice la descarga
 * fallida que tenga guardada de antes.
 */
export function shareCardUrl(handle: string, locale: Locale = DEFAULT_LOCALE): string {
  return `${siteUrl()}/api/waitlist/card/${encodeURIComponent(handle)}.jpg?l=${toLocale(locale)}`
}

// ---------- Estado que consume la landing ----------
/**
 * La landing avanza por tres pasos:
 *   'login'    → aún no ha conectado su cuenta de X
 *   'form'     → autenticado, le faltan los datos básicos
 *   'done'     → dentro de la lista; ya puede compartir el post
 */
export type WaitlistStep = 'login' | 'form' | 'done'

export type WaitlistStatusDTO = {
  step: WaitlistStep
  configured: boolean
  total: number
  entry?: {
    id: string
    xHandle: string
    xName: string
    xAvatar: string | null
    xVerified: boolean
    xFollowers: number
    email: string
    telegram: string
    wallet: string
    country: string
    reason: string
    status: string
    completed: boolean
    shared: boolean
    position: number
    createdAt: string
  }
  /** Idioma detectado para este visitante (Accept-Language). */
  locale: Locale
  /**
   * El post listo en los dos idiomas. Viajan ambos para que el botón de cambiar
   * idioma sea instantáneo, sin volver a pedir nada al servidor.
   */
  share: Record<Locale, ShareVariant>
  shareBonus: number
}

/** El post en un idioma concreto: lo que se ve, se copia y se publica. */
export type ShareVariant = {
  /** Texto del tuit. */
  text: string
  /** Enlace de referido que acompaña al texto. */
  url: string
  /** Enlace al intent de X, con texto y enlace ya rellenados. */
  intent: string
  /** Imagen que X mostrará como tarjeta del enlace. */
  card: string
}

/** Construye las dos variantes del post para una entrada de la lista. */
export function shareVariants(
  handle?: string | null,
  seed?: string | null
): Record<Locale, ShareVariant> {
  const build = (locale: Locale): ShareVariant => ({
    text: shareText(seed ?? handle, locale),
    url: shareRefUrl(handle, locale),
    intent: shareIntentUrl(handle, seed, locale),
    card: handle ? shareCardUrl(handle, locale) : `${siteUrl()}/og-cabal.png`,
  })
  return { es: build('es'), en: build('en') }
}

/** Posición en la cola: cuántos completaron el registro antes (1 = el primero). */
export async function waitlistPosition(createdAt: Date): Promise<number> {
  const before = await db.waitlistEntry.count({
    where: { completed: true, createdAt: { lte: createdAt } },
  })
  return before || 1
}
