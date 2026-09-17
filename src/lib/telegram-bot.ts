import { db } from '@/lib/db'
import { CHAT_PREFS, consumeLinkCode, upsertChatLink, type ChatPref } from '@/lib/chat-links'
import { languageButtons, settingsButtons, upcomingMessage, welcomeMessage } from '@/lib/bot-commands'
import { siteUrl } from '@/lib/waitlist'
import { userLink } from '@/lib/notifications'
import { createCallFromBot } from '@/lib/bot-call'
import { esc, tgCall, tgSend, type TelegramConfig, type TgMessage } from '@/lib/telegram'
import { isLang, langFromLocale, t, type Lang } from '@/lib/bot-i18n'

/**
 * Qué hace el bot con cada update que llega al webhook. Los comandos son en
 * inglés; las respuestas salen en el idioma del chat (ChatLink.lang) o, si el
 * chat aún no está vinculado, en el de la app de Telegram de quien escribe.
 *
 *  /start <code>      en privado: vincula el chat con la cuenta de Cabal
 *  /start@bot <code>  en un grupo (llega así al añadirlo con ?startgroup=)
 *  /link <code>       lo mismo, escrito a mano (grupos y canales)
 *  /settings          botones para elegir qué avisos llegan al chat
 *  /language          español / inglés
 *  /upcoming          los próximos lanzamientos
 *  /call <CA> [nota]  publica una call de token en Cabal
 *  /unlink            deja de mandar avisos a este chat
 *  /help
 *
 * Solo quien vinculó el chat o un administrador del grupo puede cambiar los
 * ajustes, el idioma o desvincularlo.
 */

type TgUser = { id: number; username?: string; first_name?: string; language_code?: string }
type TgChat = { id: number; type: string; title?: string; username?: string; first_name?: string }
type TgMsg = {
  message_id: number
  chat: TgChat
  from?: TgUser
  text?: string
  sender_chat?: TgChat
  migrate_to_chat_id?: number
}
export type TgUpdate = {
  update_id: number
  message?: TgMsg
  channel_post?: TgMsg
  callback_query?: { id: string; from: TgUser; message?: TgMsg; data?: string }
  my_chat_member?: { chat: TgChat; from: TgUser; new_chat_member: { status: string } }
}

/** Alias en español de antes de pasar los comandos a inglés: siguen funcionando. */
const COMMAND_ALIASES: Record<string, string> = {
  vincular: 'link',
  ajustes: 'settings',
  config: 'settings',
  proximos: 'upcoming',
  llamada: 'call',
  idioma: 'language',
  desvincular: 'unlink',
  ayuda: 'help',
}

type Reply = (m: TgMessage | string) => Promise<unknown>

export async function handleTelegramUpdate(tg: TelegramConfig, u: TgUpdate) {
  if (u.callback_query) return onCallback(tg, u.callback_query)

  if (u.my_chat_member) {
    const { chat, new_chat_member } = u.my_chat_member
    if (['left', 'kicked'].includes(new_chat_member.status)) {
      await db.chatLink.updateMany({
        where: { provider: 'telegram', chatId: String(chat.id) },
        data: { active: false, lastError: 'Bot removed from chat' },
      })
    }
    return
  }

  const msg = u.message ?? u.channel_post
  if (!msg) return

  // Un grupo que pasa a supergrupo cambia de id
  if (msg.migrate_to_chat_id) {
    await db.chatLink.updateMany({
      where: { provider: 'telegram', chatId: String(msg.chat.id) },
      data: { chatId: String(msg.migrate_to_chat_id), chatType: 'supergroup' },
    })
    return
  }

  const text = msg.text?.trim()
  if (!text?.startsWith('/')) return
  const [rawCmd, ...args] = text.split(/\s+/)
  const [name, mention] = rawCmd.slice(1).toLowerCase().split('@')
  // En grupos, un comando dirigido a otro bot no es para nosotros
  if (mention && mention !== tg.username.toLowerCase()) return
  const cmd = COMMAND_ALIASES[name] ?? name

  const chat = await findChat(msg.chat.id)
  const lang: Lang = chat ? (isLang(chat.lang) ? chat.lang : 'es') : langFromLocale(msg.from?.language_code)
  const tx = t(lang)
  const reply: Reply = (m) => tgSend(tg.token, String(msg.chat.id), typeof m === 'string' ? { text: m } : m)

  switch (cmd) {
    case 'start':
    case 'link':
      // ?startgroup=true (sin código) llega como "/start true"
      return args[0] && args[0] !== 'true' ? link(tg, msg, args[0], reply) : reply(welcomeMessage(msg.chat.type === 'private', 'telegram', lang))
    case 'settings':
      if (!chat || !chat.active) return reply(tx.notLinked(`${siteUrl()}/app`, 'telegram'))
      return reply({ text: tx.settingsTitle, buttons: settingsButtons(chat, lang) })
    case 'language':
      if (chat && !(await canManage(tg, chat, msg.chat, msg.from))) return reply(tx.onlyAdminChanges)
      return reply({ text: tx.languagePrompt, buttons: [languageButtons()] })
    case 'upcoming':
      return reply(await upcomingMessage(lang))
    case 'call': {
      if (!args[0]) return reply(tx.callUsage)
      const { message } = await createCallFromBot({
        provider: 'telegram',
        actorId: msg.from ? String(msg.from.id) : null,
        contract: args[0],
        note: args.slice(1).join(' '),
        lang,
      })
      return reply(message)
    }
    case 'unlink':
      if (!chat) return reply(tx.notLinked(`${siteUrl()}/app`, 'telegram'))
      if (!(await canManage(tg, chat, msg.chat, msg.from))) return reply(tx.onlyManagerUnlinks)
      await db.chatLink.delete({ where: { id: chat.id } })
      return reply(tx.unlinked)
    case 'help':
      return reply(welcomeMessage(msg.chat.type === 'private', 'telegram', lang))
  }
}

function findChat(chatId: number) {
  return db.chatLink.findUnique({ where: { provider_chatId: { provider: 'telegram', chatId: String(chatId) } } })
}

async function link(tg: TelegramConfig, msg: TgMsg, code: string, reply: Reply) {
  const isPrivate = msg.chat.type === 'private'
  // El idioma lo pone la app de Telegram de quien conecta; si ya estaba vinculado, se conserva
  const existing = await findChat(msg.chat.id)
  const lang: Lang = existing && isLang(existing.lang) ? existing.lang : langFromLocale(msg.from?.language_code)
  const tx = t(lang)

  // En grupos solo un admin del grupo puede conectarlo a una cuenta
  // (en canales no hay `from`: solo publican sus administradores; un admin
  // anónimo de un grupo escribe "como el grupo", con sender_chat = el chat)
  const anonymousAdmin = msg.sender_chat?.id === msg.chat.id
  if (!isPrivate && !anonymousAdmin && msg.from && !(await isChatAdmin(tg, msg.chat.id, msg.from.id))) {
    return reply(tx.onlyGroupAdminLinks('telegram'))
  }
  const user = await consumeLinkCode(code, 'telegram')
  if (!user) return reply(tx.badCode(`${siteUrl()}/app`, 'telegram'))

  const title = msg.chat.title ?? (msg.chat.username ? `@${msg.chat.username}` : msg.chat.first_name ?? null)
  const chat = await upsertChatLink({
    provider: 'telegram',
    chatId: String(msg.chat.id),
    chatType: msg.chat.type,
    title,
    userId: user.id,
    externalUserId: msg.from ? String(msg.from.id) : null,
    lang,
  })
  return reply({
    text: isPrivate ? tx.linkedPrivate(userLink(user.handle)) : tx.linkedGroup(esc(title ?? tx.thisChat), userLink(user.handle)),
    buttons: settingsButtons(chat, lang),
  })
}

async function onCallback(tg: TelegramConfig, q: NonNullable<TgUpdate['callback_query']>) {
  const answer = (text = '') => tgCall(tg.token, 'answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => {})
  if (!q.message || !q.data) return answer()
  const [kind, value] = q.data.split(':')

  const chat = await findChat(q.message.chat.id)
  const lang: Lang = chat && isLang(chat.lang) ? chat.lang : langFromLocale(q.from.language_code)

  if (kind === 'lang' && isLang(value)) {
    // Sin vincular, el idioma no se guarda en ningún sitio: solo se contesta
    if (chat) {
      if (!(await canManage(tg, chat, q.message.chat, q.from))) return answer(t(lang).onlyAdminChanges)
      await db.chatLink.update({ where: { id: chat.id }, data: { lang: value } })
    }
    const tx = t(value)
    await tgCall(tg.token, 'editMessageText', {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      text: chat ? tx.settingsTitle : tx.welcome(q.message.chat.type === 'private', 'telegram'),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: chat ? settingsButtons(chat, value) : welcomeMessage(q.message.chat.type === 'private', 'telegram', value).buttons },
    }).catch(() => {})
    return answer(tx.languageSet)
  }

  const pref = kind === 'pref' ? (value as ChatPref) : null
  if (!pref || !CHAT_PREFS.includes(pref)) return answer()
  const tx = t(lang)
  if (!chat) return answer(tx.noLongerLinked)
  if (!(await canManage(tg, chat, q.message.chat, q.from))) return answer(tx.onlyAdminChanges)

  const updated = await db.chatLink.update({ where: { id: chat.id }, data: { [pref]: !chat[pref] } })
  await tgCall(tg.token, 'editMessageReplyMarkup', {
    chat_id: q.message.chat.id,
    message_id: q.message.message_id,
    reply_markup: { inline_keyboard: settingsButtons(updated, lang) },
  }).catch(() => {})
  return answer(`${tx.prefs[pref]}: ${updated[pref] ? tx.on : tx.off}`)
}

async function canManage(
  tg: TelegramConfig,
  chat: { externalUserId: string | null },
  tgChat: TgChat,
  from?: TgUser
): Promise<boolean> {
  if (tgChat.type === 'private') return true
  // Un comando publicado en un canal (sin `from`) solo puede venir de sus administradores
  if (!from) return tgChat.type === 'channel'
  if (chat.externalUserId && chat.externalUserId === String(from.id)) return true
  return isChatAdmin(tg, tgChat.id, from.id)
}

async function isChatAdmin(tg: TelegramConfig, chatId: number, userId: number): Promise<boolean> {
  try {
    const m = await tgCall<{ status: string }>(tg.token, 'getChatMember', { chat_id: chatId, user_id: userId })
    return m.status === 'creator' || m.status === 'administrator'
  } catch {
    return false
  }
}

