import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import type { ChatLink } from '@prisma/client'
import type { ChatLinkDTO } from '@/lib/notify-types'
import type { Lang } from '@/lib/bot-i18n'

/**
 * Vincular un chat externo (Telegram hoy, Discord después) a una cuenta.
 *
 * La web genera un código con la sesión del usuario; el código viaja en el
 * enlace t.me/<bot>?start=<código> (o ?startgroup= para un grupo) y el bot lo
 * canjea. Así el bot nunca pide usuario ni contraseña y un código robado
 * caduca en minutos y sirve una sola vez.
 */

const CODE_TTL_MS = 15 * 60_000
/** Sin 0/O/1/I/L para que se pueda teclear a mano en un canal. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const hash = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest('hex')

export async function createLinkCode(userId: string, provider: 'telegram' | 'discord') {
  const bytes = randomBytes(10)
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)
  // Un código vivo por usuario: el anterior deja de valer
  await db.chatLinkCode.deleteMany({ where: { userId, provider, consumedAt: null } })
  await db.chatLinkCode.create({ data: { codeHash: hash(code), userId, provider, expiresAt } })
  return { code, expiresAt }
}

/** Canjea el código (una sola vez). Devuelve el usuario dueño o null. */
export async function consumeLinkCode(code: string, provider: 'telegram' | 'discord') {
  if (!/^[A-Za-z0-9]{6,32}$/.test(code.trim())) return null
  const row = await db.chatLinkCode.findUnique({ where: { codeHash: hash(code) } })
  if (!row || row.provider !== provider || row.consumedAt || row.expiresAt < new Date()) return null
  // updateMany con consumedAt: null es el cerrojo: si dos /start llegan a la vez, solo uno gana
  const { count } = await db.chatLinkCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  if (count === 0) return null
  return db.user.findUnique({ where: { id: row.userId }, select: { id: true, handle: true } })
}

/**
 * Crea o reasigna el vínculo de un chat. Un privado solo manda la campanita
 * por defecto; un grupo o canal recibe launches y recordatorios.
 */
export async function upsertChatLink(input: {
  provider: 'telegram' | 'discord'
  chatId: string
  chatType: string
  title: string | null
  userId: string
  externalUserId: string | null
  /** Discord: servidor del canal. En Telegram el chat ya es el grupo: null. */
  serverId?: string | null
  lang: Lang
}) {
  const isPrivate = input.chatType === 'private'
  const base = {
    chatType: input.chatType,
    title: input.title,
    userId: input.userId,
    externalUserId: input.externalUserId,
    serverId: input.serverId ?? null,
    lang: input.lang,
    active: true,
    lastError: null,
  }
  return db.chatLink.upsert({
    where: { provider_chatId: { provider: input.provider, chatId: input.chatId } },
    update: base,
    create: {
      ...base,
      provider: input.provider,
      chatId: input.chatId,
      notifyLaunches: !isPrivate,
      notifyReminders: !isPrivate,
      notifyTheses: false,
    },
  })
}

/**
 * Guarda la antelación elegida. En un privado se guarda en la cuenta del
 * usuario (vale también para su correo); en un grupo, en el propio chat.
 */
export async function setChatLeads(
  chat: { id: string; userId: string; chatType: string },
  leads: number[]
): Promise<number[]> {
  if (chat.chatType === 'private') {
    await db.user.update({ where: { id: chat.userId }, data: { reminderLeads: leads } })
  } else {
    await db.chatLink.update({ where: { id: chat.id }, data: { reminderLeads: leads } })
  }
  return leads
}

export const CHAT_PREFS = ['notifyLaunches', 'notifyReminders', 'notifyTheses', 'notifyCalls', 'onlyFollowing'] as const
export type ChatPref = (typeof CHAT_PREFS)[number]

export function toChatLinkDTO(c: ChatLink): ChatLinkDTO {
  return {
    id: c.id,
    provider: c.provider === 'discord' ? 'discord' : 'telegram',
    chatType: c.chatType,
    lang: c.lang === 'en' ? 'en' : 'es',
    title: c.title,
    notifyLaunches: c.notifyLaunches,
    notifyReminders: c.notifyReminders,
    notifyTheses: c.notifyTheses,
    reminderLeads: c.reminderLeads,
    notifyCalls: c.notifyCalls,
    tokenFilter: c.tokenFilter,
    onlyFollowing: c.onlyFollowing,
    active: c.active,
    lastError: c.lastError,
    createdAt: c.createdAt.toISOString(),
  }
}
