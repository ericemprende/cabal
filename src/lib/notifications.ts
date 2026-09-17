import { db } from '@/lib/db'
import { emailConfig, launchReminderEmail, sendEmail } from '@/lib/email'
import { networkMeta } from '@/lib/cabal'
import { siteUrl } from '@/lib/waitlist'
import { esc, sleep, TelegramApiError, telegramConfig, tgSend, type TelegramConfig, type TgMessage } from '@/lib/telegram'
import type { ChatLink } from '@prisma/client'

/**
 * Avisos a Telegram (y correo para la campanita). Una pasada (`runNotificationTick`)
 * hace tres cosas:
 *
 *  1. Launch nuevo publicado      → chats con notifyLaunches
 *  2. Tesis nueva en el feed      → chats con notifyTheses
 *  3. Falta ≤ REMINDER_LEAD_MIN   → quien activó la campanita (su Telegram
 *                                   privado + su correo verificado) y los chats
 *                                   con notifyReminders
 *
 * No hay cola: cada envío se reserva en NotificationDispatch con una clave
 * única ANTES de mandar, así una pasada solapada o relanzada no repite nada.
 * El recordatorio lleva la fecha en la clave: si el launch cambia de hora,
 * se vuelve a avisar con la hora nueva.
 *
 * Lo llama el worker en proceso (instrumentation.ts) cada NOTIFY_INTERVAL
 * segundos y también se puede lanzar a mano desde el panel admin.
 */

export const REMINDER_LEAD_MIN = 60
/** Espera antes de difundir algo recién publicado: da margen a borrarlo u ocultarlo. */
const PUBLISH_GRACE_MS = 60_000
/** Nunca se difunde nada publicado hace más de esto (worker caído mucho rato). */
const MAX_BACKLOG_MS = 6 * 3600_000
/** Telegram admite ~30 mensajes/s en total: se va holgado. */
const SEND_GAP_MS = 50

export type TickResult = { launches: number; theses: number; reminders: number; messages: number; emails: number }

export async function runNotificationTick(): Promise<TickResult> {
  const result: TickResult = { launches: 0, theses: 0, reminders: 0, messages: 0, emails: 0 }
  const tg = await telegramConfig()
  const telegram = tg?.enabled ? tg : null

  if (telegram) {
    await announceNewLaunches(telegram, result)
    await announceNewTheses(telegram, result)
  }
  await sendReminders(telegram, result)
  return result
}

// ---------- 1. Launches nuevos ----------

async function announceNewLaunches(tg: TelegramConfig, r: TickResult) {
  const now = Date.now()
  const launches = await db.launch.findMany({
    where: {
      hidden: false,
      createdAt: { gte: lowerBound(tg.since, now), lte: new Date(now - PUBLISH_GRACE_MS) },
      launchAt: { gt: new Date(now) },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    include: { createdBy: { select: { handle: true } } },
  })
  const pending = await notDispatched(launches.map((l) => `launch:new:${l.id}`))
  for (const l of launches) {
    const key = `launch:new:${l.id}`
    if (!pending.has(key) || !(await reserve(key))) continue
    const chats = await db.chatLink.findMany({ where: { provider: 'telegram', active: true, notifyLaunches: true } })
    const sent = await broadcast(tg, chats, launchMessage(l, 'new'))
    await markSent(key, sent)
    r.launches++
    r.messages += sent
  }
}

// ---------- 2. Tesis nuevas ----------

async function announceNewTheses(tg: TelegramConfig, r: TickResult) {
  const now = Date.now()
  const posts = await db.post.findMany({
    where: { kind: 'thesis', createdAt: { gte: lowerBound(tg.since, now), lte: new Date(now - PUBLISH_GRACE_MS) } },
    orderBy: { createdAt: 'asc' },
    take: 20,
    include: {
      user: { select: { handle: true } },
      launch: { select: { id: true, name: true, ticker: true, isPrivate: true, hidden: true } },
    },
  })
  const pending = await notDispatched(posts.map((p) => `post:${p.id}`))
  for (const p of posts) {
    const key = `post:${p.id}`
    if (!pending.has(key) || !(await reserve(key))) continue
    // Una tesis de un launch oculto tampoco se difunde
    if (p.launch?.hidden) {
      await markSent(key, 0)
      continue
    }
    const chats = await db.chatLink.findMany({ where: { provider: 'telegram', active: true, notifyTheses: true } })
    const sent = await broadcast(tg, chats, thesisMessage(p))
    await markSent(key, sent)
    r.theses++
    r.messages += sent
  }
}

// ---------- 3. Recordatorios ----------

async function sendReminders(tg: TelegramConfig | null, r: TickResult) {
  const now = Date.now()
  const launches = await db.launch.findMany({
    where: { hidden: false, launchAt: { gt: new Date(now), lte: new Date(now + REMINDER_LEAD_MIN * 60_000) } },
    include: { createdBy: { select: { handle: true } } },
  })
  const keyOf = (l: { id: string; launchAt: Date }) => `launch:soon:${l.id}:${l.launchAt.getTime()}`
  const pending = await notDispatched(launches.map(keyOf))
  const mail = emailConfig() !== null || process.env.NODE_ENV !== 'production'

  for (const l of launches) {
    const key = keyOf(l)
    if (!pending.has(key)) continue
    const bellUserIds = (await db.launchReminder.findMany({ where: { launchId: l.id }, select: { userId: true } })).map(
      (x) => x.userId
    )
    // Sin Telegram ni correo no se reserva: se avisará cuando alguno esté listo (si aún da tiempo)
    if (!tg && !(mail && bellUserIds.length)) continue
    if (!(await reserve(key))) continue

    let sent = 0
    const minutes = Math.max(1, Math.round((l.launchAt.getTime() - now) / 60_000))
    const msg = launchMessage(l, 'soon', minutes)
    const alreadySent = new Set<string>()

    if (tg) {
      // Campanita: al privado de cada usuario, aunque no tenga notifyReminders
      if (bellUserIds.length) {
        const privates = await db.chatLink.findMany({
          where: { provider: 'telegram', active: true, chatType: 'private', userId: { in: bellUserIds } },
        })
        sent += await broadcast(tg, privates, launchMessage(l, 'bell', minutes))
        privates.forEach((c) => alreadySent.add(c.id))
      }
      const chats = await db.chatLink.findMany({ where: { provider: 'telegram', active: true, notifyReminders: true } })
      sent += await broadcast(
        tg,
        chats.filter((c) => !alreadySent.has(c.id)),
        msg
      )
    }

    if (mail && bellUserIds.length) {
      const users = await db.user.findMany({
        where: { id: { in: bellUserIds }, emailVerified: true, email: { not: null } },
        select: { id: true, email: true },
      })
      const { subject, html, text } = launchReminderEmail(l, minutes, launchUrl(l.id))
      for (const u of users) {
        try {
          await sendEmail({ to: u.email!, subject, html, text })
          r.emails++
        } catch (e) {
          console.error(`[notify] correo de campanita a ${u.id} (${l.id}):`, (e as Error).message)
        }
      }
    }

    await markSent(key, sent)
    r.reminders++
    r.messages += sent
  }
}

// ---------- Envío ----------

/** Manda el mismo mensaje a varios chats; desactiva los que ya no existen. Devuelve los enviados. */
export async function broadcast(tg: TelegramConfig, chats: ChatLink[], msg: TgMessage): Promise<number> {
  let ok = 0
  for (const chat of chats) {
    try {
      const { migratedTo } = await tgSend(tg.token, chat.chatId, msg)
      if (migratedTo) {
        await db.chatLink
          .update({ where: { id: chat.id }, data: { chatId: migratedTo, chatType: 'supergroup' } })
          .catch(() => {})
      }
      ok++
    } catch (e) {
      const gone = e instanceof TelegramApiError && e.chatGone
      await db.chatLink
        .update({
          where: { id: chat.id },
          data: { lastError: (e as Error).message.slice(0, 300), ...(gone ? { active: false } : {}) },
        })
        .catch(() => {})
      if (!gone) console.error(`[notify] telegram ${chat.chatId}:`, (e as Error).message)
    }
    await sleep(SEND_GAP_MS)
  }
  return ok
}

async function reserve(key: string): Promise<boolean> {
  try {
    await db.notificationDispatch.create({ data: { key } })
    return true
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return false
    throw e
  }
}

async function markSent(key: string, sentCount: number) {
  await db.notificationDispatch.update({ where: { key }, data: { sentCount } }).catch(() => {})
}

async function notDispatched(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set()
  const done = await db.notificationDispatch.findMany({ where: { key: { in: keys } }, select: { key: true } })
  const doneSet = new Set(done.map((d) => d.key))
  return new Set(keys.filter((k) => !doneSet.has(k)))
}

function lowerBound(since: Date, now: number): Date {
  return new Date(Math.max(since.getTime(), now - MAX_BACKLOG_MS))
}

// ---------- Mensajes ----------

export function launchUrl(launchId: string): string {
  return `${siteUrl()}/app?launch=${encodeURIComponent(launchId)}`
}

type LaunchForMessage = {
  id: string
  name: string
  ticker: string | null
  isPrivate: boolean
  network: string
  launchAt: Date
  dateConfirmed: boolean
  description: string
  submitterRole: string
  createdBy: { handle: string }
}

/** El ticker de un launch privado no se publica (igual que en la web). */
function launchLabel(l: { name: string; ticker: string | null; isPrivate: boolean }): string {
  return l.ticker && !l.isPrivate ? `$${esc(l.ticker)} · ${esc(l.name)}` : esc(l.name)
}

export function fmtLaunchDate(d: Date): string {
  return (
    d.toLocaleString('es', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }) + ' UTC'
  )
}

function fmtIn(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  return `${Math.round(h / 24)} días`
}

function snippet(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

export function launchMessage(l: LaunchForMessage, kind: 'new' | 'soon' | 'bell', minutes?: number): TgMessage {
  const label = launchLabel(l)
  const net = networkMeta(l.network).label
  const when = `${fmtLaunchDate(l.launchAt)}${l.dateConfirmed ? '' : ' (estimada)'}`
  const head =
    kind === 'new'
      ? '🚀 <b>Nuevo lanzamiento en Cabal</b>'
      : kind === 'bell'
        ? `🔔 <b>Tu recordatorio: sale en ${minutes} min</b>`
        : `⏰ <b>Sale en ${minutes} min</b>`
  const lines = [
    head,
    '',
    `<b>${label}</b> · ${esc(net)}`,
    `🗓 ${when}${kind === 'new' ? ` · en ${fmtIn(l.launchAt.getTime() - Date.now())}` : ''}`,
  ]
  if (kind === 'new' && l.description) lines.push('', esc(snippet(l.description, 280)))
  lines.push('', `${l.submitterRole === 'dev' ? 'Publicado por el dev' : 'Compartido por'} @${esc(l.createdBy.handle)}`)
  return { text: lines.join('\n'), buttons: [[{ text: 'Ver en Cabal', url: launchUrl(l.id) }]] }
}

function thesisMessage(p: {
  content: string
  user: { handle: string }
  launch: { id: string; name: string; ticker: string | null; isPrivate: boolean } | null
}): TgMessage {
  const lines = [`🧠 <b>Nueva tesis de @${esc(p.user.handle)}</b>`]
  if (p.launch) lines.push(`Sobre <b>${launchLabel(p.launch)}</b>`)
  lines.push('', esc(snippet(p.content, 600)))
  const url = p.launch ? launchUrl(p.launch.id) : `${siteUrl()}/app`
  return { text: lines.join('\n'), buttons: [[{ text: 'Leer en Cabal', url }]] }
}
