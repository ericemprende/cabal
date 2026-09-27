import { db } from '@/lib/db'
import { getAmmoSettings } from '@/lib/ammo'
import { emailConfig, launchReminderEmail, sendEmail } from '@/lib/email'
import { networkMeta } from '@/lib/cabal'
import { siteUrl } from '@/lib/waitlist'
import { sleep, TelegramApiError, telegramConfig, tgSend } from '@/lib/telegram'
import { dcSend, discordConfig, DiscordApiError } from '@/lib/discord'
import { esc, type BotMessage, type BotProvider } from '@/lib/bot-message'
import type { ChatLink } from '@prisma/client'
import { t, type Lang } from '@/lib/bot-i18n'
import { DEFAULT_REMINDER_LEAD } from '@/lib/notify-types'
import { matchesTokenFilter, type FilterSubject } from '@/lib/token-filter'
import { pushBroadcast, pushConfigured, pushToUsers } from '@/lib/push'
import { postChatAnnouncement } from '@/lib/chat-announce'
import { fmtMultiple } from '@/lib/call-score'
import { rankCallers } from '@/lib/call-results'
import { affiliateTerminalsLine } from '@/lib/bot-call'
import { dexPaidAt } from '@/lib/chain-stats'

/**
 * Avisos a Telegram y Discord (y correo para la campanita). Una pasada
 * (`runNotificationTick`) hace tres cosas:
 *
 *  1. Launch nuevo publicado      → chats con notifyLaunches
 *  2. Tesis nueva en el feed      → chats con notifyTheses
 *  3. Falta ≤ REMINDER_LEAD_MIN   → quien activó la campanita (su chat privado
 *                                   con el bot + su correo verificado) y los
 *                                   chats con notifyReminders
 *  4. Respuesta en el chat en vivo → chat privado con el bot de quien recibe
 *                                   la respuesta
 *
 * Cada uno de esos avisos sale además como notificación push a los
 * dispositivos que lo tengan encendido (ver lib/push.ts): el usuario elige en
 * su perfil cuáles quiere y en qué dispositivo.
 *
 * No hay cola: cada envío se reserva en NotificationDispatch con una clave
 * única ANTES de mandar, así una pasada solapada o relanzada no repite nada.
 * El recordatorio lleva la fecha en la clave: si el launch cambia de hora,
 * se vuelve a avisar con la hora nueva.
 *
 * La clave de reserva es una por aviso, no una por proveedor: un mismo launch
 * se difunde de una vez a los chats de los dos bots. Por eso cada proveedor
 * lleva su propio `since` hasta el momento de enviar (ver `Sender`): conectar
 * Discord hoy no reenvía a sus canales lo que ya se publicó ayer.
 *
 * Lo llama el worker en proceso (instrumentation.ts) cada NOTIFY_INTERVAL
 * segundos y también se puede lanzar a mano desde el panel admin.
 */

/** Antelación por defecto; cada usuario y cada grupo puede cambiar la suya. */
export const REMINDER_LEAD_MIN = DEFAULT_REMINDER_LEAD
/** Espera antes de difundir algo recién publicado: da margen a borrarlo u ocultarlo. */
const PUBLISH_GRACE_MS = 60_000
/** Nunca se difunde nada publicado hace más de esto (worker caído mucho rato). */
const MAX_BACKLOG_MS = 6 * 3600_000
/** Ventana que se mira cuando el único canal es push (sin bots conectados). */
const PUSH_BACKLOG_MS = 10 * 60_000
/** Telegram admite ~30 mensajes/s y Discord ~50: se va holgado. */
const SEND_GAP_MS = 50

export type TickResult = {
  launches: number
  calls: number
  theses: number
  reminders: number
  messages: number
  emails: number
  /** Notificaciones push enviadas a navegadores y a la app instalada. */
  push: number
  /** Avisos de munición fuerte difundidos a los chats. */
  boosts: number
  /** Avisos de resultado de calls ("hizo 5x", "DEX pagado") en su chat. */
  milestones: number
}

/** Un bot listo para enviar. `since` es desde cuándo difunde ese proveedor. */
type Sender = {
  since: Date
  send: (chatId: string, msg: BotMessage) => Promise<{ migratedTo?: string }>
  /** El chat ya no admite mensajes del bot: se desactiva en vez de reintentar. */
  gone: (e: unknown) => boolean
}

type Senders = Partial<Record<BotProvider, Sender>>

async function activeSenders(): Promise<Senders> {
  const [tg, dc] = await Promise.all([telegramConfig(), discordConfig()])
  const senders: Senders = {}
  if (tg?.enabled) {
    senders.telegram = {
      since: tg.since,
      send: (chatId, msg) => tgSend(tg.token, chatId, msg),
      gone: (e) => e instanceof TelegramApiError && e.chatGone,
    }
  }
  if (dc?.enabled) {
    senders.discord = {
      since: dc.since,
      send: async (chatId, msg) => {
        await dcSend(dc.token, chatId, msg)
        return {}
      },
      gone: (e) => e instanceof DiscordApiError && e.chatGone,
    }
  }
  return senders
}

const providersOf = (s: Senders) => Object.keys(s) as BotProvider[]

export async function runNotificationTick(): Promise<TickResult> {
  const result: TickResult = { launches: 0, calls: 0, theses: 0, reminders: 0, messages: 0, emails: 0, push: 0, boosts: 0, milestones: 0 }
  const senders = await activeSenders()

  // Los tres primeros avisos también salen por push, así que la pasada se hace
  // aunque no haya ningún bot conectado.
  if (providersOf(senders).length > 0 || pushConfigured()) {
    await announceNewLaunches(senders, result)
    await announceNewCalls(senders, result)
    await announceNewTheses(senders, result)
    await sendChatReplies(senders, result)
    // Los avisos de munición solo salen por los bots (no por push): son para
    // mover al grupo, no para interrumpir a alguien en su móvil.
    if (providersOf(senders).length > 0) {
      await announceBigBoosts(senders, result)
      await announceCallMilestones(senders, result)
      await announceDexPaid(senders, result)
    }
  }
  await sendReminders(senders, result)
  // Aviso recurrente del chat en vivo (donaciones): no depende de los bots.
  await postChatAnnouncement().catch((e) => console.error('[chat-announce]', (e as Error).message))
  return result
}

// ---------- 1. Launches nuevos ----------

async function announceNewLaunches(senders: Senders, r: TickResult) {
  const now = Date.now()
  const launches = await db.launch.findMany({
    where: {
      hidden: false,
      createdAt: { gte: lowerBound(senders, now), lte: new Date(now - PUBLISH_GRACE_MS) },
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
    const chats = await db.chatLink.findMany({
      where: { provider: { in: providersOf(senders) }, active: true, notifyLaunches: true },
    })
    const sent = await broadcast(senders, await onlyMatching(chats, launchSubject(l)), (lang) => launchMessage(l, 'new', lang), l.createdAt)
    const pushed = await pushBroadcast('launches', {
      title: `Nuevo launch: ${l.ticker ? `$${l.ticker}` : l.name}`,
      body: `${l.name} · ${networkMeta(l.network).label} · por @${l.createdBy.handle}`,
      url: `/app?launch=${l.id}`,
      tag: `launch-${l.id}`,
    })
    await markSent(key, sent + pushed)
    r.launches++
    r.messages += sent
    r.push += pushed
  }
}

// ---------- 2. Calls nuevas ----------

/**
 * Las calls publicadas en Cabal (desde la web o desde otro chat) llegan a los
 * chats que lo hayan activado. Es el sentido contrario al de lib/bot-call, que
 * trae a Cabal las que se dan en Telegram o Discord.
 *
 * Al chat donde nació la call no se le reenvía: allí ya la vieron al darla.
 */
async function announceNewCalls(senders: Senders, r: TickResult) {
  const now = Date.now()
  const calls = await db.post.findMany({
    where: {
      kind: 'call',
      contract: { not: null },
      createdAt: { gte: lowerBound(senders, now), lte: new Date(now - PUBLISH_GRACE_MS) },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: {
      id: true,
      userId: true,
      content: true,
      contract: true,
      network: true,
      entryMc: true,
      resultSymbol: true,
      chatLinkId: true,
      createdAt: true,
      user: { select: { handle: true } },
      token: { select: { ticker: true, contract: true } },
    },
  })
  const pending = await notDispatched(calls.map((c) => `call:${c.id}`))
  for (const c of calls) {
    const key = `call:${c.id}`
    if (!pending.has(key) || !(await reserve(key))) continue
    const chats = await db.chatLink.findMany({
      where: {
        provider: { in: providersOf(senders) },
        active: true,
        notifyCalls: true,
        ...(c.chatLinkId ? { id: { not: c.chatLinkId } } : {}),
      },
    })
    const subject = { contracts: [c.contract, c.token?.contract], tickers: [c.token?.ticker], authorId: c.userId }
    const sent = await broadcast(senders, await onlyMatching(chats, subject), (lang) => callMessage(c, lang), c.createdAt)
    const ticker = c.token?.ticker ? `$${c.token.ticker}` : 'un token'
    const pushed = await pushBroadcast('calls', {
      title: `Call de @${c.user.handle}`,
      body: `${ticker} · ${c.content.slice(0, 120)}`,
      url: '/app?tab=feed',
      tag: `call-${c.id}`,
    })
    await markSent(key, sent + pushed)
    r.calls++
    r.messages += sent
    r.push += pushed
  }
}

// ---------- 3. Tesis nuevas ----------

async function announceNewTheses(senders: Senders, r: TickResult) {
  const now = Date.now()
  const posts = await db.post.findMany({
    where: { kind: 'thesis', createdAt: { gte: lowerBound(senders, now), lte: new Date(now - PUBLISH_GRACE_MS) } },
    orderBy: { createdAt: 'asc' },
    take: 20,
    include: {
      user: { select: { handle: true } },
      launch: { select: { id: true, name: true, ticker: true, isPrivate: true, hidden: true, contract: true } },
      token: { select: { ticker: true, contract: true } },
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
    const chats = await db.chatLink.findMany({
      where: { provider: { in: providersOf(senders) }, active: true, notifyTheses: true },
    })
    const subject = {
      contracts: [p.contract, p.token?.contract, p.launch?.contract],
      tickers: [p.token?.ticker, p.launch?.ticker],
      authorId: p.userId,
    }
    const sent = await broadcast(senders, await onlyMatching(chats, subject), (lang) => thesisMessage(p, lang), p.createdAt)
    const pushed = await pushBroadcast('theses', {
      title: `Tesis de @${p.user.handle}`,
      body: p.content.slice(0, 140),
      url: p.launch ? `/app?launch=${p.launch.id}` : '/app?tab=feed',
      tag: `thesis-${p.id}`,
    })
    await markSent(key, sent + pushed)
    r.theses++
    r.messages += sent
    r.push += pushed
  }
}

// ---------- Respuestas del chat en vivo ----------

/** Una respuesta más vieja que esto ya no se avisa (worker caído): llegaría tarde. */
const CHAT_REPLY_MAX_AGE_MS = 30 * 60_000

async function sendChatReplies(senders: Senders, r: TickResult) {
  const now = Date.now()
  const since = new Date(Math.max(lowerBound(senders, now).getTime(), now - CHAT_REPLY_MAX_AGE_MS))
  const replies = await db.chatMessage.findMany({
    where: { replyToId: { not: null }, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    take: 50,
    include: {
      user: { select: { id: true, handle: true } },
      replyTo: { select: { body: true, userId: true } },
    },
  })
  // Responderse a uno mismo no avisa.
  const toNotify = replies.filter((m) => m.replyTo && m.replyTo.userId !== m.user.id)
  const pending = await notDispatched(toNotify.map((m) => `chat-reply:${m.id}`))
  for (const m of toNotify) {
    const key = `chat-reply:${m.id}`
    if (!pending.has(key) || !(await reserve(key))) continue
    const privates = await db.chatLink.findMany({
      where: { provider: { in: providersOf(senders) }, active: true, chatType: 'private', userId: m.replyTo!.userId },
    })
    const sent = await broadcast(senders, privates, (lang) => chatReplyMessage(m, lang), m.createdAt)
    const pushed = await pushToUsers([m.replyTo!.userId], 'replies', {
      title: `@${m.user.handle} te respondió`,
      body: m.body.slice(0, 140),
      url: '/app?tab=chat',
      tag: 'chat-reply',
    })
    await markSent(key, sent + pushed)
    r.messages += sent
    r.push += pushed
  }
}

// ---------- 4. Recordatorios ----------

/**
 * Las antelaciones que alguien está usando ahora mismo. Solo esas se recorren:
 * si nadie ha pedido 5 minutos, no se hace esa pasada.
 */
async function leadsInUse(): Promise<number[]> {
  const [users, chats] = await Promise.all([
    db.user.findMany({ where: { launchReminders: { some: {} } }, select: { reminderLeads: true } }),
    db.chatLink.findMany({ where: { active: true, notifyReminders: true }, select: { reminderLeads: true } }),
  ])
  return [...new Set([...users, ...chats].flatMap((x) => x.reminderLeads))].sort((a, b) => b - a)
}

async function sendReminders(senders: Senders, r: TickResult) {
  for (const lead of await leadsInUse()) {
    await sendRemindersForLead(senders, r, lead)
  }
}

/**
 * Los avisos de una antelación concreta. Cada antelación tiene su propia clave
 * de reserva, así que un mismo launch puede avisar a los 60 minutos a un grupo
 * y a los 5 a quien lo pidió, sin pisarse.
 *
 * La de 60 conserva la clave antigua (sin sufijo) porque es la que tenía todo
 * el mundo antes de poder elegir: si cambiara, al desplegar se reavisaría de
 * los launches que ya se habían avisado.
 */
async function sendRemindersForLead(senders: Senders, r: TickResult, lead: number) {
  const now = Date.now()
  const providers = providersOf(senders)
  const launches = await db.launch.findMany({
    where: { hidden: false, launchAt: { gt: new Date(now), lte: new Date(now + lead * 60_000) } },
    include: { createdBy: { select: { handle: true } } },
  })
  const suffix = lead === DEFAULT_REMINDER_LEAD ? '' : `:${lead}m`
  const keyOf = (l: { id: string; launchAt: Date }) => `launch:soon:${l.id}:${l.launchAt.getTime()}${suffix}`
  const pending = await notDispatched(launches.map(keyOf))
  const mail = emailConfig() !== null || process.env.NODE_ENV !== 'production'

  for (const l of launches) {
    const key = keyOf(l)
    if (!pending.has(key)) continue
    // Solo quien haya pedido justo esta antelación
    const bellUserIds = (
      await db.launchReminder.findMany({
        where: { launchId: l.id, user: { reminderLeads: { has: lead } } },
        select: { userId: true },
      })
    ).map((x) => x.userId)
    // Sin ningún bot, correo ni push no se reserva: se avisará cuando alguno
    // esté listo (si aún da tiempo)
    const canPush = pushConfigured() && bellUserIds.length > 0
    if (providers.length === 0 && !canPush && !(mail && bellUserIds.length)) continue
    if (!(await reserve(key))) continue

    let sent = 0
    let pushedNow = 0
    const minutes = Math.max(1, Math.round((l.launchAt.getTime() - now) / 60_000))
    const alreadySent = new Set<string>()

    if (providers.length > 0) {
      // Campanita: al privado de cada usuario, aunque no tenga notifyReminders
      if (bellUserIds.length) {
        const privates = await db.chatLink.findMany({
          where: { provider: { in: providers }, active: true, chatType: 'private', userId: { in: bellUserIds } },
        })
        sent += await broadcast(senders, privates, (lang) => launchMessage(l, 'bell', lang, minutes))
        privates.forEach((c) => alreadySent.add(c.id))
      }
      // En un privado manda la antelación del usuario; en un grupo, la del grupo
      const chats = await db.chatLink.findMany({
        where: {
          provider: { in: providers },
          active: true,
          notifyReminders: true,
          OR: [
            { chatType: { not: 'private' }, reminderLeads: { has: lead } },
            { chatType: 'private', user: { reminderLeads: { has: lead } } },
          ],
        },
      })
      sent += await broadcast(
        senders,
        (await onlyMatching(chats, launchSubject(l))).filter((c) => !alreadySent.has(c.id)),
        (lang) => launchMessage(l, 'soon', lang, minutes)
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

    // Campanita por push: a los dispositivos de quien la activó
    if (canPush) {
      const pushed = await pushToUsers(bellUserIds, 'reminders', {
        title: `${l.ticker ? `$${l.ticker}` : l.name} sale en ${minutes} min`,
        body: `${l.name} · ${networkMeta(l.network).label}`,
        url: `/app?launch=${l.id}`,
        tag: `soon-${l.id}`,
      })
      pushedNow = pushed
      r.push += pushed
    }

    await markSent(key, sent + pushedNow)
    r.reminders++
    r.messages += sent
  }
}

// ---------- Envío ----------

type Subject = FilterSubject & { authorId: string }

/**
 * Deja fuera los chats cuyo filtro no deja pasar este aviso: el de token
 * (su lista no incluye este token) y el de "solo gente que sigo" (quien
 * vinculó el chat no sigue al autor; lo suyo propio sí pasa).
 */
async function onlyMatching(chats: ChatLink[], subject: Subject): Promise<ChatLink[]> {
  const byToken = chats.filter((c) => matchesTokenFilter(c.tokenFilter, subject))
  const owners = [...new Set(byToken.filter((c) => c.onlyFollowing && c.userId !== subject.authorId).map((c) => c.userId))]
  const following = owners.length
    ? new Set(
        (
          await db.follow.findMany({
            where: { userId: { in: owners }, targetId: subject.authorId },
            select: { userId: true },
          })
        ).map((f) => f.userId)
      )
    : new Set<string>()
  return byToken.filter((c) => !c.onlyFollowing || c.userId === subject.authorId || following.has(c.userId))
}

function launchSubject(l: { contract: string | null; ticker: string | null; createdById: string }): Subject {
  return { contracts: [l.contract], tickers: [l.ticker], authorId: l.createdById }
}

/**
 * Manda un aviso a varios chats, cada uno con el bot de su proveedor y en su
 * idioma; desactiva los que ya no existen. `publishedAt` deja fuera a los bots
 * conectados después de que se publicara. Devuelve los enviados.
 */
async function broadcast(
  senders: Senders,
  chats: ChatLink[],
  render: (lang: Lang) => BotMessage | Promise<BotMessage>,
  publishedAt?: Date
): Promise<number> {
  let ok = 0
  const byLang = new Map<string, BotMessage>()
  for (const chat of chats) {
    const sender = senders[chat.provider as BotProvider]
    if (!sender) continue
    if (publishedAt && sender.since > publishedAt) continue
    const lang: Lang = chat.lang === 'en' ? 'en' : 'es'
    if (!byLang.has(lang)) byLang.set(lang, await render(lang))
    try {
      const { migratedTo } = await sender.send(chat.chatId, byLang.get(lang)!)
      if (migratedTo) {
        await db.chatLink
          .update({ where: { id: chat.id }, data: { chatId: migratedTo, chatType: 'supergroup' } })
          .catch(() => {})
      }
      ok++
    } catch (e) {
      const gone = sender.gone(e)
      await db.chatLink
        .update({
          where: { id: chat.id },
          data: { lastError: (e as Error).message.slice(0, 300), ...(gone ? { active: false } : {}) },
        })
        .catch(() => {})
      if (!gone) console.error(`[notify] ${chat.provider} ${chat.chatId}:`, (e as Error).message)
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

/** Lo más antiguo que se mira: el `since` más viejo de los bots activos, con tope. */
function lowerBound(senders: Senders, now: number): Date {
  const sinces = Object.values(senders).map((s) => s.since.getTime())
  // Sin bots, pero con push encendido, se mira una ventana corta: al activar
  // las push por primera vez nadie quiere recibir el historial de hoy.
  const oldest = sinces.length ? Math.min(...sinces) : now - (pushConfigured() ? PUSH_BACKLOG_MS : 0)
  return new Date(Math.max(oldest, now - MAX_BACKLOG_MS))
}

// ---------- Mensajes ----------

export function launchUrl(launchId: string): string {
  return `${siteUrl()}/app?launch=${encodeURIComponent(launchId)}`
}

export function profileUrl(handle: string): string {
  return `${siteUrl()}/u/${encodeURIComponent(handle)}`
}

/**
 * "@handle" como enlace al perfil en Cabal, con la arroba DENTRO del enlace.
 *
 * Si se deja como texto suelto, Telegram lo detecta como mención suya y al
 * tocarlo abre una búsqueda de usuarios de Telegram (que no existe). Lo mismo
 * le pasa a "$TICKER", que Telegram convierte en búsqueda de cashtag: por eso
 * el ticker sale siempre dentro de `launchLink`.
 */
export function userLink(handle: string): string {
  return `<a href="${profileUrl(handle)}">@${esc(handle)}</a>`
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
export function launchLabel(l: { name: string; ticker: string | null; isPrivate: boolean }): string {
  return l.ticker && !l.isPrivate ? `$${esc(l.ticker)} · ${esc(l.name)}` : esc(l.name)
}

/** El mismo nombre, enlazado a la ficha del launch en Cabal (ver `userLink`). */
export function launchLink(l: { id: string; name: string; ticker: string | null; isPrivate: boolean }): string {
  return `<a href="${launchUrl(l.id)}">${launchLabel(l)}</a>`
}

export function fmtLaunchDate(d: Date, lang: Lang): string {
  return (
    d.toLocaleString(t(lang).locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }) + ' UTC'
  )
}

function fmtIn(ms: number, lang: Lang): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  return `${Math.round(h / 24)} ${t(lang).days}`
}

function snippet(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

export function launchMessage(l: LaunchForMessage, kind: 'new' | 'soon' | 'bell', lang: Lang, minutes?: number): BotMessage {
  const tx = t(lang)
  const label = launchLink(l)
  const net = networkMeta(l.network).label
  const when = `${fmtLaunchDate(l.launchAt, lang)}${l.dateConfirmed ? '' : ` (${tx.estimated})`}`
  const left = fmtIn((minutes ?? 0) * 60_000, lang)
  const head = kind === 'new' ? tx.newLaunch : kind === 'bell' ? tx.bellHead(left) : tx.soonHead(left)
  const lines = [
    head,
    '',
    `<b>${label}</b> · ${esc(net)}`,
    `🗓 ${when}${kind === 'new' ? ` · ${tx.inPrefix} ${fmtIn(l.launchAt.getTime() - Date.now(), lang)}` : ''}`,
  ]
  if (kind === 'new' && l.description) lines.push('', esc(snippet(l.description, 280)))
  lines.push('', `${l.submitterRole === 'dev' ? tx.byDev : tx.byCommunity} ${userLink(l.createdBy.handle)}`)
  return { text: lines.join('\n'), buttons: [[{ text: tx.viewOnCabal, url: launchUrl(l.id) }]] }
}

/**
 * Una call para difundir. Lleva la misma tarjeta que se ve en Cabal
 * (/api/posts/[id]/card): es la imagen del resultado, que al publicarla marca
 * 1.0X y luego cuenta la historia sola. Incluye las estadísticas del caller.
 */
async function callMessage(
  c: {
    id: string
    content: string
    contract: string | null
    network: string | null
    entryMc: number | null
    resultSymbol: string | null
    userId: string
    user: { handle: string }
  },
  lang: Lang
): Promise<BotMessage> {
  const tx = t(lang)
  const symbol = c.resultSymbol ? `$${esc(c.resultSymbol)}` : esc((c.contract ?? '').slice(0, 8))
  const lines = [tx.callHead(userLink(c.user.handle)), '', `<b>${symbol}</b>`]
  if (c.entryMc !== null) lines.push(`${tx.callEntryAt} ${fmtMcShort(c.entryMc)}`)
  if (c.content) lines.push('', esc(c.content.slice(0, 400)))
  // Terminales con enlace de afiliado (GMGN • AXI • PHO…), igual que en la ficha del bot
  if (c.contract && c.network) {
    const terminals = await affiliateTerminalsLine(c.network, c.contract)
    if (terminals) lines.push('', terminals, `<code>${esc(c.contract)}</code>`)
  }
  const stats = await callerStatsBlock(c.userId, lang)
  if (stats) lines.push('', stats)

  return {
    text: lines.join('\n'),
    image: `${siteUrl()}/api/posts/${encodeURIComponent(c.id)}/card`,
    buttons: [
      [{ text: tx.viewCallOnCabal, url: `${siteUrl()}/app?post=${encodeURIComponent(c.id)}` }],
      ...callerStatsButtons(c.user.handle, lang),
    ],
  }
}

function fmtMcShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n.toFixed(0)}`
}

function chatReplyMessage(m: { body: string; user: { handle: string }; replyTo: { body: string } | null }, lang: Lang): BotMessage {
  const tx = t(lang)
  const lines = [tx.chatReplyHead(userLink(m.user.handle)), '', esc(snippet(m.body, 500))]
  if (m.replyTo) lines.push('', `<i>${tx.yourMessage}: ${esc(snippet(m.replyTo.body, 140))}</i>`)
  return { text: lines.join('\n'), buttons: [[{ text: tx.replyOnCabal, url: `${siteUrl()}/app` }]] }
}

function thesisMessage(
  p: {
    content: string
    user: { handle: string }
    launch: { id: string; name: string; ticker: string | null; isPrivate: boolean } | null
  },
  lang: Lang
): BotMessage {
  const tx = t(lang)
  const lines = [tx.thesisHead(userLink(p.user.handle))]
  if (p.launch) lines.push(`${tx.about} <b>${launchLink(p.launch)}</b>`)
  lines.push('', esc(snippet(p.content, 600)))
  const url = p.launch ? launchUrl(p.launch.id) : `${siteUrl()}/app`
  return { text: lines.join('\n'), buttons: [[{ text: tx.readOnCabal, url }]] }
}

// ---------- 5. Munición fuerte ----------

/**
 * Cuando alguien mete munición de verdad en un proyecto, los chats se enteran.
 *
 * Solo pasan los disparos grandes (`ammo_notify_at`, editable en /admin): un
 * aviso por cada 100 balas convertiría esto en ruido y los grupos lo apagarían
 * la primera tarde. El mensaje lleva el ticker, quién disparó, cuántas balas y
 * hasta cuándo se queda arriba.
 */
async function announceBigBoosts(senders: Senders, r: TickResult) {
  const now = Date.now()
  const { notifyAt } = await getAmmoSettings()
  const boosts = await db.boost.findMany({
    where: {
      bullets: { gte: notifyAt },
      createdAt: { gte: lowerBound(senders, now), lte: new Date(now - PUBLISH_GRACE_MS) },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    include: { user: { select: { id: true, handle: true } } },
  })
  const pending = await notDispatched(boosts.map((b) => `boost:${b.id}`))
  for (const b of boosts) {
    const key = `boost:${b.id}`
    if (!pending.has(key) || !(await reserve(key))) continue

    // El proyecto al que disparó: un launch oculto (o algo ya borrado) no se
    // anuncia, igual que no se anuncian sus tesis.
    const target =
      b.targetType === 'launch'
        ? await db.launch.findUnique({
            where: { id: b.targetId },
            select: { id: true, name: true, ticker: true, isPrivate: true, hidden: true, contract: true, network: true },
          })
        : await db.token.findUnique({
            where: { id: b.targetId },
            select: { id: true, name: true, ticker: true, contract: true, network: true },
          })
    if (!target || ('hidden' in target && target.hidden)) {
      await markSent(key, 0)
      continue
    }

    const chats = await db.chatLink.findMany({
      where: { provider: { in: providersOf(senders) }, active: true, notifyBoosts: true },
    })
    const subject = { contracts: [target.contract], tickers: [target.ticker], authorId: b.user.id }
    const sent = await broadcast(
      senders,
      await onlyMatching(chats, subject),
      (lang) => boostMessage({ boost: b, target }, lang),
      b.createdAt
    )
    await markSent(key, sent)
    r.boosts++
    r.messages += sent
  }
}

function boostMessage(
  p: {
    boost: { bullets: number; endsAt: Date; targetType: string; targetId: string; user: { handle: string } }
    target: { id: string; name: string; ticker: string | null }
  },
  lang: Lang
): BotMessage {
  const tx = t(lang)
  const { boost, target } = p
  const symbol = target.ticker ? `$${esc(target.ticker)}` : esc(target.name)
  const hours = Math.round((boost.bullets / 60) * 10) / 10
  const url =
    boost.targetType === 'launch'
      ? `${siteUrl()}/app?launch=${encodeURIComponent(target.id)}`
      : `${siteUrl()}/app?token=${encodeURIComponent(target.id)}`
  return {
    text: [
      tx.boostHead(userLink(boost.user.handle)),
      '',
      `<b>${symbol}</b> · ${boost.bullets.toLocaleString(tx.locale)} ${tx.bullets}`,
      tx.boostUntil(hours),
    ].join('\n'),
    buttons: [[{ text: tx.viewOnCabal, url }]],
  }
}

// ---------- Estadísticas del caller ----------

/**
 * Bloque "últimos 30 días" de quien da la call, en el idioma del chat. Sin
 * calls evaluadas en ese periodo devuelve null y el mensaje sale sin él.
 */
export async function callerStatsBlock(userId: string, lang: Lang): Promise<string | null> {
  const ranking = await rankCallers('30d')
  const idx = ranking.findIndex((r) => r.userId === userId)
  if (idx === -1 || ranking[idx].summary.calls === 0) return null
  const s = ranking[idx].summary
  const tx = t(lang)
  return [
    tx.statsTitle,
    `🏆 ${tx.statsRank} <b>#${idx + 1}</b> · 📞 ${tx.statsCalls(s.calls)}`,
    `✅ <b>${tx.statsHitRate}: ${s.winRate}%</b>`,
    `📈 ${tx.statsAvgPeak} ${fmtMultiple(s.avgPeak)} · 🎯 ${tx.statsBest} <b>${fmtMultiple(s.bestMultiple)}</b>`,
  ].join('\n')
}

/** Botones que llevan a Cabal: la analítica del caller y los tops de 7 días y 24 h. */
export function callerStatsButtons(handle: string, lang: Lang): { text: string; url: string }[][] {
  const tx = t(lang)
  const lb = (p: string) => `${siteUrl()}/app?tab=leaderboard&period=${p}`
  return [
    [{ text: tx.statsProfile, url: profileUrl(handle) }],
    [
      { text: tx.stats7d, url: lb('7d') },
      { text: tx.stats24h, url: lb('24h') },
    ],
  ]
}

// ---------- 7. Resultados de las calls del chat ----------

/**
 * Cuando una call nacida en un grupo cruza 2x, 3x, 5x… se avisa en ESE grupo
 * (no en los demás: es la prueba de que alguien de allí lo vio antes). El pico
 * lo guarda lib/call-results; aquí solo se mira si cruzó un escalón nuevo.
 * Solo se avisa del escalón más alto alcanzado: si saltó de 1,5x a 6x sale un
 * único "5x", no tres mensajes seguidos.
 */
const MILESTONES = [2, 3, 5, 10, 20, 50, 100]
/** Calls más viejas ya no avisan: el grupo ni se acuerda. */
const MILESTONE_WINDOW_MS = 3 * 24 * 3600_000
/** Tope por chat y pasada, para que un día muy verde no llene el grupo de golpe. */
const MILESTONES_PER_CHAT = 3

function milestoneOf(peak: number | null): number | null {
  if (peak === null) return null
  let hit: number | null = null
  for (const m of MILESTONES) if (peak >= m) hit = m
  return hit
}

async function announceCallMilestones(senders: Senders, r: TickResult) {
  const calls = await db.post.findMany({
    where: {
      kind: 'call',
      peakMultiple: { gte: MILESTONES[0] },
      createdAt: { gte: new Date(Date.now() - MILESTONE_WINDOW_MS) },
      chatLink: { is: { active: true, notifyMilestones: true, provider: { in: providersOf(senders) } } },
    },
    orderBy: { peakMultiple: 'desc' },
    take: 60,
    select: {
      id: true,
      peakMultiple: true,
      entryMc: true,
      resultSymbol: true,
      contract: true,
      chatLink: true,
      user: { select: { handle: true } },
    },
  })
  const keyOf = (c: (typeof calls)[number]) => `call-x:${c.id}:${milestoneOf(c.peakMultiple)}`
  const pending = await notDispatched(calls.map(keyOf))
  const perChat = new Map<string, number>()
  for (const c of calls) {
    const x = milestoneOf(c.peakMultiple)
    const chat = c.chatLink
    if (!x || !chat || !pending.has(keyOf(c))) continue
    if ((perChat.get(chat.id) ?? 0) >= MILESTONES_PER_CHAT) continue
    if (!(await reserve(keyOf(c)))) continue
    perChat.set(chat.id, (perChat.get(chat.id) ?? 0) + 1)
    const sent = await broadcast(senders, [chat], (lang) => milestoneMessage(c, x, lang))
    await markSent(keyOf(c), sent)
    r.milestones++
    r.messages += sent
  }
}

function callSymbol(c: { resultSymbol: string | null; contract: string | null }): string {
  return c.resultSymbol ? `$${esc(c.resultSymbol)}` : esc((c.contract ?? '').slice(0, 8))
}

function milestoneMessage(
  c: { id: string; peakMultiple: number | null; entryMc: number | null; resultSymbol: string | null; contract: string | null; user: { handle: string } },
  x: number,
  lang: Lang
): BotMessage {
  const tx = t(lang)
  const lines = [tx.milestoneHead(`${x}x`, callSymbol(c)), tx.milestoneBy(userLink(c.user.handle))]
  if (c.entryMc !== null && c.peakMultiple !== null) {
    lines.push(tx.milestoneMc(fmtMcShort(c.entryMc), fmtMcShort(c.entryMc * c.peakMultiple)))
  }
  return {
    text: lines.join('\n'),
    image: `${siteUrl()}/api/posts/${encodeURIComponent(c.id)}/card`,
    buttons: [[{ text: tx.viewCallOnCabal, url: `${siteUrl()}/app?post=${encodeURIComponent(c.id)}` }]],
  }
}

/**
 * "DEX pagado": el equipo del token pagó su ficha en DexScreener, señal que
 * los grupos siguen de cerca. Se mira para las calls recientes nacidas en un
 * grupo y se avisa allí si el pago llegó DESPUÉS de la call. Si ya estaba
 * pagado al llamarlo, se marca como visto para no volver a preguntar.
 */
const DEX_PAID_WINDOW_MS = 48 * 3600_000

async function announceDexPaid(senders: Senders, r: TickResult) {
  const calls = await db.post.findMany({
    where: {
      kind: 'call',
      contract: { not: null },
      network: { not: null },
      createdAt: { gte: new Date(Date.now() - DEX_PAID_WINDOW_MS) },
      chatLink: { is: { active: true, notifyMilestones: true, provider: { in: providersOf(senders) } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      id: true,
      contract: true,
      network: true,
      createdAt: true,
      resultSymbol: true,
      chatLink: true,
      user: { select: { handle: true } },
    },
  })
  const pending = await notDispatched(calls.map((c) => `dexpaid:${c.id}`))
  for (const c of calls) {
    const key = `dexpaid:${c.id}`
    if (!pending.has(key) || !c.chatLink) continue
    const paidAt = await dexPaidAt(c.network!, c.contract!)
    if (paidAt === null) continue
    if (!(await reserve(key))) continue
    if (paidAt < c.createdAt.getTime()) {
      await markSent(key, 0)
      continue
    }
    const sent = await broadcast(senders, [c.chatLink], (lang) => {
      const tx = t(lang)
      return {
        text: [tx.dexPaidHead(callSymbol(c)), tx.dexPaidBy(userLink(c.user.handle))].join('\n'),
        buttons: [[{ text: tx.viewCallOnCabal, url: `${siteUrl()}/app?post=${encodeURIComponent(c.id)}` }]],
      }
    })
    await markSent(key, sent)
    r.milestones++
    r.messages += sent
  }
}
