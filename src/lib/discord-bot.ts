import { db } from '@/lib/db'
import { CHAT_PREFS, consumeLinkCode, setChatLeads, upsertChatLink, type ChatPref } from '@/lib/chat-links'
import { languageButtons, leadMenuButtons, leadSummary, settingsButtons, upcomingMessage, welcomeMessage } from '@/lib/bot-commands'
import { siteUrl } from '@/lib/waitlist'
import { userLink } from '@/lib/notifications'
import { handleContractFromBot, pnlMessage } from '@/lib/bot-call'
import { leaderboardMessage } from '@/lib/bot-leaderboard'
import { dcCall, editInteractionReply, toDiscordPayload, type DiscordConfig } from '@/lib/discord'
import { esc, type BotMessage } from '@/lib/bot-message'
import { isLang, langFromLocale, t, type Lang } from '@/lib/bot-i18n'
import { isReminderLead, toggleLead } from '@/lib/notify-types'

/**
 * Qué hace el bot de Discord con cada interacción que llega al endpoint.
 * Mismos comandos que en Telegram; lo que cambia es el envoltorio:
 *
 *  /start [code]   sin código saluda; con código vincula el chat
 *  /link  <code>   vincula el chat con la cuenta de Cabal
 *  /settings       botones para elegir qué avisos llegan al chat
 *  /language       español / inglés
 *  /upcoming       los próximos lanzamientos (visible para todo el canal)
 *  /call <CA>      publica una call de token en Cabal
 *  /pnl <CA>       tarjeta con el resultado de tu call de ese token
 *  /leaderboard    ranking del servidor (o de Cabal, en privado)
 *  /unlink         deja de mandar avisos a este chat
 *  /help
 *
 * Todo lo demás se responde en efímero (solo lo ve quien escribió el comando),
 * así los ajustes de un servidor no ensucian el canal.
 *
 * En un servidor, solo quien lo vinculó o alguien con "Gestionar servidor"
 * puede vincularlo, cambiar los ajustes, el idioma o desvincularlo. En el
 * privado con el bot manda el propio usuario.
 */

const EPHEMERAL = 64

// Tipos de interacción y de respuesta de Discord
const PING = 1
const APPLICATION_COMMAND = 2
const MESSAGE_COMPONENT = 3
const PONG = 1
const CHANNEL_MESSAGE = 4
const UPDATE_MESSAGE = 7
// Acuse de recibo: Discord enseña "pensando…" y el mensaje se manda luego
const DEFERRED_MESSAGE = 5

// Tipos de canal que nos importan; el resto se trata como un canal de servidor
const CHANNEL_DM = 1
const CHANNEL_GROUP_DM = 3
const CHANNEL_ANNOUNCEMENT = 5

// Bits del bitfield de permisos de Discord (BigInt: el bitfield pasa de 2^53)
const ADMINISTRATOR = BigInt(8)
const MANAGE_GUILD = BigInt(32)

type DcUser = { id: string; username?: string; global_name?: string }

export type DcInteraction = {
  id: string
  type: number
  token: string
  application_id?: string
  channel_id?: string
  channel?: { id: string; type?: number; name?: string }
  guild_id?: string
  member?: { user?: DcUser; permissions?: string }
  user?: DcUser
  locale?: string
  guild_locale?: string
  data?: {
    name?: string
    options?: { name: string; value?: unknown }[]
    custom_id?: string
  }
}

export type DcResponse = {
  type: number
  data?: { content?: string; components?: unknown[]; flags?: number }
}

export async function handleDiscordInteraction(cfg: DiscordConfig, i: DcInteraction): Promise<DcResponse> {
  if (i.type === PING) return { type: PONG }
  if (i.type === APPLICATION_COMMAND) return onCommand(cfg, i)
  if (i.type === MESSAGE_COMPONENT) return onComponent(cfg, i)
  return say('…')
}

// ---------- Comandos ----------

async function onCommand(cfg: DiscordConfig, i: DcInteraction): Promise<DcResponse> {
  const channelId = chatIdOf(i)
  if (!channelId) return say('No he podido identificar este canal.')

  const chat = await findChat(channelId)
  const lang = langOf(chat, i)
  const tx = t(lang)
  const isPrivate = chatTypeOf(i) === 'private'

  switch (i.data?.name) {
    case 'start':
    case 'link': {
      const code = optionValue(i, 'code')
      if (!code) return reply(welcomeMessage(isPrivate, 'discord', lang))
      return link(cfg, i, code, lang)
    }
    case 'settings':
      if (!chat || !chat.active) return say(tx.notLinked(`${siteUrl()}/app`, 'discord'))
      return reply({ text: tx.settingsTitle, buttons: settingsButtons(chat, lang) })
    case 'language':
      if (chat && !canManage(chat, i)) return say(tx.onlyAdminChanges)
      return reply({ text: tx.languagePrompt, buttons: [languageButtons(chat ? lang : undefined)] })
    case 'upcoming':
      // El único que se publica en el canal: es información útil para todos
      return reply(await upcomingMessage(lang), false)
    case 'call': {
      const contract = optionValue(i, 'contract')
      if (!contract) return say(tx.callUsage)
      // Publicar la call consulta DexScreener y Discord corta a los 3 segundos:
      // se acusa recibo ya y el mensaje de verdad se manda al terminar.
      void deferred(cfg, i, lang, () =>
        handleContractFromBot({
          provider: 'discord',
          actorId: actorId(i),
          chat,
          contract,
          note: optionValue(i, 'note') ?? '',
          lang,
          mode: 'command',
        }).then((r) => r.message)
      )
      return { type: DEFERRED_MESSAGE }
    }
    case 'pnl': {
      const contract = optionValue(i, 'contract')
      if (!contract) return say(tx.pnlUsage)
      // La tarjeta se calcula contra DexScreener: tambien en diferido
      void deferred(cfg, i, lang, () => pnlMessage({ provider: 'discord', actorId: actorId(i), contract, lang }))
      return { type: DEFERRED_MESSAGE }
    }
    case 'leaderboard': {
      void deferred(cfg, i, lang, () => leaderboardMessage(chat, optionValue(i, 'period'), lang))
      return { type: DEFERRED_MESSAGE }
    }
    case 'unlink':
      if (!chat) return say(tx.notLinked(`${siteUrl()}/app`, 'discord'))
      if (!canManage(chat, i)) return say(tx.onlyManagerUnlinks)
      await db.chatLink.delete({ where: { id: chat.id } })
      return say(tx.unlinked)
    case 'help':
      return reply(welcomeMessage(isPrivate, 'discord', lang))
  }
  return say(tx.noLongerLinked)
}

async function link(cfg: DiscordConfig, i: DcInteraction, code: string, lang: Lang): Promise<DcResponse> {
  const tx = t(lang)
  const chatId = chatIdOf(i)!
  const chatType = chatTypeOf(i)

  // En un servidor solo un administrador puede conectarlo a una cuenta de Cabal
  if (i.guild_id && !isGuildAdmin(i)) return say(tx.onlyGroupAdminLinks('discord'))

  const user = await consumeLinkCode(code, 'discord')
  if (!user) return say(tx.badCode(`${siteUrl()}/app`, 'discord'))

  const title = await chatTitle(cfg, i)
  const chat = await upsertChatLink({
    provider: 'discord',
    chatId,
    chatType,
    title,
    userId: user.id,
    externalUserId: actorId(i),
    serverId: i.guild_id ?? null,
    lang,
  })
  return reply({
    text:
      chatType === 'private'
        ? tx.linkedPrivate(userLink(user.handle))
        : tx.linkedGroup(esc(title ?? tx.thisChat), userLink(user.handle)),
    buttons: settingsButtons(chat, lang),
  })
}

/**
 * Segunda mitad de los comandos lentos: se ejecuta después de haber contestado
 * el tipo 5 y reescribe ese mensaje con el resultado. Se llama sin await a
 * propósito, así que se traga sus propios errores: aquí ya nadie los recogería.
 */
async function deferred(
  cfg: DiscordConfig,
  i: DcInteraction,
  lang: Lang,
  work: () => Promise<BotMessage | null>
) {
  try {
    const message = await work()
    await editInteractionReply(cfg.appId, i.token, message ?? { text: t(lang).callFailed })
  } catch (e) {
    console.error(`[discord] /${i.data?.name}`, (e as Error).message)
    await editInteractionReply(cfg.appId, i.token, { text: t(lang).callFailed }).catch(() => {})
  }
}

// ---------- Botones ----------

async function onComponent(cfg: DiscordConfig, i: DcInteraction): Promise<DcResponse> {
  const channelId = chatIdOf(i)
  const [kind, value] = (i.data?.custom_id ?? '').split(':')
  const chat = channelId ? await findChat(channelId) : null
  const lang = langOf(chat, i)

  if (kind === 'lang' && isLang(value)) {
    // Sin vincular, el idioma no se guarda en ningún sitio: solo se contesta
    if (chat) {
      if (!canManage(chat, i)) return say(t(lang).onlyAdminChanges)
      await db.chatLink.update({ where: { id: chat.id }, data: { lang: value } })
    }
    const tx = t(value)
    return chat
      ? update({ text: tx.settingsTitle, buttons: settingsButtons(chat, value) })
      : update(welcomeMessage(chatTypeOf(i) === 'private', 'discord', value))
  }

  // Navegación entre la pantalla de ajustes y la de antelación
  if (kind === 'menu') {
    const tx = t(lang)
    if (!chat) return say(tx.noLongerLinked)
    return value === 'lead'
      ? update({ text: tx.leadTitle, buttons: leadMenuButtons(chat, lang) })
      : update({ text: tx.settingsTitle, buttons: settingsButtons(chat, lang) })
  }

  if (kind === 'lead') {
    const minutes = Number(value)
    const tx = t(lang)
    if (!chat) return say(tx.noLongerLinked)
    if (!isReminderLead(minutes)) return say('…')
    if (!canManage(chat, i)) return say(tx.onlyAdminChanges)
    const leads = toggleLead(chat.reminderLeads, minutes)
    await setChatLeads(chat, leads)
    return update({ text: `${tx.leadTitle}

${tx.leadSet(leadSummary(leads))}`, buttons: leadMenuButtons({ ...chat, reminderLeads: leads }, lang) })
  }

  const pref = kind === 'pref' ? (value as ChatPref) : null
  if (!pref || !CHAT_PREFS.includes(pref)) return say('…')
  const tx = t(lang)
  if (!chat) return say(tx.noLongerLinked)
  if (!canManage(chat, i)) return say(tx.onlyAdminChanges)

  const updated = await db.chatLink.update({ where: { id: chat.id }, data: { [pref]: !chat[pref] } })
  return update({ text: tx.settingsTitle, buttons: settingsButtons(updated, lang) })
}

// ---------- Respuestas ----------

/** Mensaje con botones. Por defecto efímero: solo lo ve quien lanzó el comando. */
function reply(msg: BotMessage, ephemeral = true): DcResponse {
  return { type: CHANNEL_MESSAGE, data: { ...toDiscordPayload(msg), ...(ephemeral ? { flags: EPHEMERAL } : {}) } }
}

/** Solo texto (los avisos cortos de "no puedes" o "hecho"). */
function say(text: string): DcResponse {
  return reply({ text })
}

/** Reescribe el mensaje del que salió el botón, en vez de mandar otro. */
function update(msg: BotMessage): DcResponse {
  return { type: UPDATE_MESSAGE, data: toDiscordPayload(msg) }
}

// ---------- Contexto de la interacción ----------

function chatIdOf(i: DcInteraction): string | null {
  return i.channel?.id ?? i.channel_id ?? null
}

function chatTypeOf(i: DcInteraction): string {
  switch (i.channel?.type) {
    case CHANNEL_DM:
      return 'private'
    case CHANNEL_GROUP_DM:
      return 'group'
    case CHANNEL_ANNOUNCEMENT:
      return 'channel'
    default:
      // Sin `channel` (interacciones antiguas), un chat sin servidor es un privado
      return i.channel === undefined && !i.guild_id ? 'private' : 'group'
  }
}

function actorId(i: DcInteraction): string | null {
  return i.member?.user?.id ?? i.user?.id ?? null
}

function findChat(chatId: string) {
  return db.chatLink.findUnique({ where: { provider_chatId: { provider: 'discord', chatId } } })
}

function langOf(chat: { lang: string } | null, i: DcInteraction): Lang {
  if (chat && isLang(chat.lang)) return chat.lang
  return langFromLocale(i.locale ?? i.guild_locale)
}

function isGuildAdmin(i: DcInteraction): boolean {
  try {
    const perms = BigInt(i.member?.permissions ?? '0')
    const none = BigInt(0)
    return (perms & ADMINISTRATOR) !== none || (perms & MANAGE_GUILD) !== none
  } catch {
    return false
  }
}

function canManage(chat: { externalUserId: string | null }, i: DcInteraction): boolean {
  if (!i.guild_id) return true // privado con el bot: manda el propio usuario
  if (chat.externalUserId && chat.externalUserId === actorId(i)) return true
  return isGuildAdmin(i)
}

/** "Mi servidor · #general" para que el usuario reconozca el chat en su perfil. */
async function chatTitle(cfg: DiscordConfig, i: DcInteraction): Promise<string | null> {
  const channel = i.channel?.name ? `#${i.channel.name}` : null
  if (!i.guild_id) return channel
  const guild = await dcCall<{ name?: string }>(cfg.token, 'GET', `/guilds/${i.guild_id}`).catch(() => null)
  return [guild?.name, channel].filter(Boolean).join(' · ') || null
}

function optionValue(i: DcInteraction, name: string): string | null {
  const v = i.data?.options?.find((o) => o.name === name)?.value
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
