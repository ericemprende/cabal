import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { announcementEmail, sendEmail } from '@/lib/email'
import { isValidEmail } from '@/lib/email-codes'
import { siteUrl } from '@/lib/waitlist'

/**
 * Anuncios por correo a toda la comunidad (el lanzamiento oficial y poco más).
 *
 * Destinatarios: cuentas con el correo verificado + correos de la whitelist,
 * sin repetir, sin los que se dieron de baja y sin los que ya lo recibieron.
 * Se manda por tandas (`limit`): el plan gratis de Resend corta a los 100 al
 * día, así que el admin vuelve a pulsar "Enviar" al día siguiente y sigue por
 * donde iba. Con un plan de pago se puede subir la tanda.
 */

export type BroadcastDraft = { key: string; subject: string; body: string; ctaLabel: string; ctaUrl: string }

const DRAFT_KEY = 'email_broadcast_draft'
/** Pausa entre correos: Resend admite unas pocas peticiones por segundo. */
const GAP_MS = 600

export const DEFAULT_DRAFT: BroadcastDraft = {
  key: 'launch-oficial',
  subject: '🚀 Cabal ya está abierto',
  body: [
    'Llegó el día: Cabal abre oficialmente sus puertas.',
    'Todo lo que acumulaste en la whitelist sigue en tu cuenta. Entra, da hype a los launches que te gusten, publica tus calls y empieza a sumar puntos para el airdrop.',
    'Nos vemos dentro.',
  ].join('\n\n'),
  ctaLabel: 'Entrar en Cabal',
  ctaUrl: `${siteUrl()}/app`,
}

export async function loadDraft(): Promise<BroadcastDraft> {
  const row = await db.setting.findUnique({ where: { key: DRAFT_KEY } })
  if (!row) return DEFAULT_DRAFT
  try {
    return { ...DEFAULT_DRAFT, ...(JSON.parse(row.value) as Partial<BroadcastDraft>) }
  } catch {
    return DEFAULT_DRAFT
  }
}

export async function saveDraft(d: BroadcastDraft): Promise<void> {
  const value = JSON.stringify(d)
  await db.setting.upsert({ where: { key: DRAFT_KEY }, update: { value }, create: { key: DRAFT_KEY, value } })
}

// ---------- Baja ----------
function sign(email: string): string {
  return createHmac('sha256', process.env.AUTH_SECRET || 'cabal-unsub-secret-v1')
    .update(`unsub:${email}`)
    .digest('base64url')
}

export function unsubscribeUrl(email: string): string {
  const e = Buffer.from(email).toString('base64url')
  return `${siteUrl()}/api/email/unsubscribe?e=${e}&s=${sign(email)}`
}

/** Devuelve el correo si el enlace de baja es auténtico. */
export function readUnsubscribe(e: string | null, s: string | null): string | null {
  if (!e || !s) return null
  const email = Buffer.from(e, 'base64url').toString('utf8')
  const expected = Buffer.from(sign(email))
  const given = Buffer.from(s)
  return expected.length === given.length && timingSafeEqual(expected, given) ? email : null
}

export async function optOut(email: string): Promise<void> {
  await db.emailOptOut.upsert({ where: { email }, update: {}, create: { email } })
}

// ---------- Destinatarios ----------
async function audience(): Promise<string[]> {
  const [users, waitlist, optouts] = await Promise.all([
    db.user.findMany({ where: { emailVerified: true, email: { not: null } }, select: { email: true } }),
    db.waitlistEntry.findMany({ where: { email: { not: '' }, status: { not: 'rejected' } }, select: { email: true } }),
    db.emailOptOut.findMany({ select: { email: true } }),
  ])
  const blocked = new Set(optouts.map((o) => o.email))
  const all = new Set<string>()
  for (const r of [...users, ...waitlist]) {
    const email = r.email?.trim().toLowerCase()
    if (email && isValidEmail(email) && !blocked.has(email)) all.add(email)
  }
  return [...all]
}

export type BroadcastStats = { total: number; sent: number; pending: number; optedOut: number }

export async function broadcastStats(key: string): Promise<BroadcastStats> {
  const [list, sentRows, optedOut] = await Promise.all([
    audience(),
    db.emailBroadcastSend.findMany({ where: { key }, select: { email: true } }),
    db.emailOptOut.count(),
  ])
  const sent = new Set(sentRows.map((r) => r.email))
  const pending = list.filter((e) => !sent.has(e)).length
  return { total: list.length, sent: list.length - pending, pending, optedOut }
}

function render(d: BroadcastDraft, to: string) {
  const unsub = unsubscribeUrl(to)
  return {
    to,
    ...announcementEmail({ subject: d.subject, body: d.body, ctaLabel: d.ctaLabel, ctaUrl: d.ctaUrl, unsubscribeUrl: unsub }),
    // Gmail y Yahoo exigen la baja en un clic para los envíos masivos
    headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  }
}

/** Prueba: manda el anuncio a un solo correo, sin marcarlo como enviado. */
export async function sendBroadcastTest(d: BroadcastDraft, to: string): Promise<void> {
  await sendEmail(render(d, to))
}

/**
 * Manda la siguiente tanda. Se para al primer error (normalmente el tope
 * diario del proveedor) y devuelve cuántos salieron y por qué se paró.
 */
export async function sendBroadcastBatch(
  d: BroadcastDraft,
  limit: number
): Promise<{ sent: number; error: string | null }> {
  const sentRows = await db.emailBroadcastSend.findMany({ where: { key: d.key }, select: { email: true } })
  const done = new Set(sentRows.map((r) => r.email))
  const next = (await audience()).filter((e) => !done.has(e)).slice(0, limit)

  let sent = 0
  for (const to of next) {
    try {
      await sendEmail(render(d, to))
    } catch (e) {
      return { sent, error: (e as Error).message }
    }
    await db.emailBroadcastSend.create({ data: { key: d.key, email: to } }).catch(() => {})
    sent++
    await new Promise((r) => setTimeout(r, GAP_MS))
  }
  return { sent, error: null }
}
