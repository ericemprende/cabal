import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { awardPoints, getPointRules } from '@/lib/api-helpers'
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
  const link = await db.chatLink.upsert({
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

  // Conectar el Telegram propio cuenta como verificar una identidad, igual que
  // X o Google: es lo que enciende la campanita y lo que permite contarte entre
  // los miembros de tu comunidad que ya están en Cabal.
  //
  // Solo el privado, y solo Telegram: en Discord la verificación se hace por
  // OAuth desde el perfil (ver lib/social.ts), así que pagar también aquí sería
  // cobrar dos veces por la misma cuenta.
  if (isPrivate && input.provider === 'telegram' && input.externalUserId) {
    await awardVerifyTelegram(input.userId)
  }

  return link
}

/** Bonus por conectar Telegram, una sola vez por cuenta. */
async function awardVerifyTelegram(userId: string): Promise<void> {
  try {
    const prior = await db.pointEvent.findFirst({
      where: { userId, reason: 'verify_telegram' },
      select: { id: true },
    })
    if (prior) return
    const amount = (await getPointRules()).points_verify_telegram ?? 0
    if (amount > 0) {
      await awardPoints(userId, 'verify_telegram', 'Telegram conectado al bot', amount)
    }
  } catch {
    // Vincular el chat nunca debe fallar por no poder abonar el bonus.
  }
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

/**
 * Enlace público para unirse al clan, pegado por su dueño.
 *
 * Esto se le enseña a cualquiera en el ranking de clanes, así que solo se
 * aceptan enlaces del propio proveedor: si no, el campo sería un hueco para
 * colar cualquier URL en una tarjeta que parece de Cabal. Devuelve el enlace
 * limpio, o null si no vale.
 */
export function sanitizeInviteUrl(provider: string, raw: string): string | null {
  const value = raw.trim()
  if (!value || value.length > 200) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const path = url.pathname
  if (path.length < 2) return null
  const ok =
    provider === 'discord'
      ? host === 'discord.gg' || ((host === 'discord.com' || host === 'discordapp.com') && path.startsWith('/invite/'))
      : host === 't.me' || host === 'telegram.me' || host === 'telegram.dog'
  // Se reconstruye desde cero en https: da igual cómo lo pegue el dueño, y sin
  // query, que un enlace de invitación no la necesita
  return ok ? `https://${host}${path}` : null
}

export const CHAT_PREFS = ['notifyLaunches', 'notifyReminders', 'notifyTheses', 'notifyCalls', 'notifyBoosts', 'notifyMilestones', 'fixLinks', 'onlyFollowing'] as const
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
    notifyBoosts: c.notifyBoosts,
    notifyMilestones: c.notifyMilestones,
    fixLinks: c.fixLinks,
    tokenFilter: c.tokenFilter,
    onlyFollowing: c.onlyFollowing,
    inviteUrl: c.inviteUrl,
    active: c.active,
    lastError: c.lastError,
    createdAt: c.createdAt.toISOString(),
  }
}
