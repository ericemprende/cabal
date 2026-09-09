import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { SHARE_PHRASES, pickIndex } from '@/lib/share-card'

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
 * Texto del post. La frase de cabecera se elige de forma estable por usuario
 * (misma persona → misma frase, y coincide con la plantilla de su tarjeta).
 */
export function shareText(seed?: string | null): string {
  const phrase = seed ? SHARE_PHRASES[pickIndex(seed, SHARE_PHRASES.length)] : SHARE_PHRASES[0]
  return [
    phrase,
    'Launches antes de que salgan, tesis de la comunidad e historial real de cada dev.',
    'Entra conmigo a la lista de espera:',
  ].join('\n\n')
}

/**
 * URL del intent de X con el texto y el enlace de referido ya rellenados.
 * El enlace lleva ?ref=<handle>: quien entre por ahí queda registrado como
 * invitado suyo y le genera el 10% de sus puntos.
 */
export function shareIntentUrl(handle?: string | null, seed?: string | null): string {
  const url = handle ? `${siteUrl()}/?ref=${encodeURIComponent(handle)}` : siteUrl()
  const params = new URLSearchParams({ text: shareText(seed ?? handle), url })
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

/** URL pública de la tarjeta personalizada (og:image del enlace de referido). */
export function shareCardUrl(handle: string): string {
  return `${siteUrl()}/api/waitlist/card/${encodeURIComponent(handle)}.png`
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
  shareText: string
  shareUrl: string
  shareIntent: string
  shareCard: string
  shareBonus: number
}

/** Posición en la cola: cuántos completaron el registro antes (1 = el primero). */
export async function waitlistPosition(createdAt: Date): Promise<number> {
  const before = await db.waitlistEntry.count({
    where: { completed: true, createdAt: { lte: createdAt } },
  })
  return before || 1
}
