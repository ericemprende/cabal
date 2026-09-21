import webpush from 'web-push'
import { db } from '@/lib/db'
import { siteUrl } from '@/lib/waitlist'

/**
 * Avisos push del navegador (PWA).
 *
 * Cada dispositivo que acepta los avisos guarda una fila en PushSubscription
 * con sus propias preferencias: se puede querer los launches en el móvil y
 * nada en el escritorio. Quien recibe qué lo decide `pushTargets`.
 *
 * Hacen falta dos variables de entorno con el par de claves VAPID (las genera
 * `bun run push:keys`). Sin ellas, todo esto se queda quieto y el resto de la
 * app funciona igual:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   y, opcional, VAPID_SUBJECT
 *
 * El navegador recibe el aviso en public/sw.js, que es quien lo enseña.
 */

/** Los tipos de aviso que se pueden encender y apagar por dispositivo. */
export const PUSH_KINDS = ['launches', 'reminders', 'calls', 'theses', 'replies'] as const
export type PushKind = (typeof PUSH_KINDS)[number]

const PREF_FIELD: Record<PushKind, 'notifyLaunches' | 'notifyReminders' | 'notifyCalls' | 'notifyTheses' | 'notifyReplies'> = {
  launches: 'notifyLaunches',
  reminders: 'notifyReminders',
  calls: 'notifyCalls',
  theses: 'notifyTheses',
  replies: 'notifyReplies',
}

export type PushPayload = {
  title: string
  body: string
  /** A dónde lleva al tocarlo. Ruta del sitio, no URL completa. */
  url?: string
  /** Avisos con la misma etiqueta se sustituyen en vez de acumularse. */
  tag?: string
}

let configured: boolean | null = null

/** ¿Están puestas las claves VAPID? Se prepara la librería la primera vez. */
export function pushConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    configured = false
    return false
  }
  // El "subject" identifica a quien envía; los servicios de push piden un
  // mailto: o una URL por si tienen que avisar de un problema.
  const subject = process.env.VAPID_SUBJECT || siteUrl()
  webpush.setVapidDetails(subject.startsWith('http') || subject.startsWith('mailto:') ? subject : `mailto:${subject}`, publicKey, privateKey)
  configured = true
  return true
}

export function pushPublicKey(): string | null {
  return pushConfigured() ? process.env.VAPID_PUBLIC_KEY! : null
}

/** Los dispositivos de estos usuarios que quieren este tipo de aviso. */
export async function pushTargets(userIds: string[], kind: PushKind) {
  if (!pushConfigured() || userIds.length === 0) return []
  return db.pushSubscription.findMany({
    where: { userId: { in: userIds }, active: true, [PREF_FIELD[kind]]: true },
  })
}

/** Todos los dispositivos que quieren este tipo de aviso (difusión). */
export async function pushTargetsAll(kind: PushKind) {
  if (!pushConfigured()) return []
  return db.pushSubscription.findMany({ where: { active: true, [PREF_FIELD[kind]]: true } })
}

type Target = { id: string; endpoint: string; p256dh: string; auth: string }

/**
 * Envía un aviso a varios dispositivos. Devuelve cuántos salieron.
 *
 * Si el servicio de push responde 404 o 410, esa suscripción ya no existe
 * (desinstalaron la app, borraron los datos del navegador): se borra, porque
 * reintentarla no va a funcionar nunca más.
 */
export async function sendPush(targets: Target[], payload: PushPayload): Promise<number> {
  if (!pushConfigured() || targets.length === 0) return 0
  const body = JSON.stringify({ ...payload, url: payload.url ?? '/app' })
  let ok = 0
  const dead: string[] = []

  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          body,
          { TTL: 3600, urgency: 'normal' }
        )
        ok++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          dead.push(t.id)
        } else {
          const message = (e as Error).message?.slice(0, 300) ?? 'error'
          await db.pushSubscription
            .update({ where: { id: t.id }, data: { lastError: message } })
            .catch(() => null)
        }
      }
    })
  )

  if (dead.length) {
    await db.pushSubscription.deleteMany({ where: { id: { in: dead } } }).catch(() => null)
  }
  return ok
}

/** Atajo: avisar a unos usuarios concretos (campanita, respuestas del chat). */
export async function pushToUsers(userIds: string[], kind: PushKind, payload: PushPayload): Promise<number> {
  return sendPush(await pushTargets(userIds, kind), payload)
}

/** Atajo: difundir a todo el que lo tenga activado (launches, calls, tesis). */
export async function pushBroadcast(kind: PushKind, payload: PushPayload): Promise<number> {
  return sendPush(await pushTargetsAll(kind), payload)
}
