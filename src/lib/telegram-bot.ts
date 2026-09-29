import { db } from '@/lib/db'
import { CHAT_PREFS, consumeLinkCode, setChatLeads, upsertChatLink, type ChatPref } from '@/lib/chat-links'
import { filterCommand, languageButtons, leadMenuButtons, leadSummary, settingsButtons, upcomingMessage, welcomeMessage } from '@/lib/bot-commands'
import { siteUrl } from '@/lib/waitlist'
import { userLink } from '@/lib/notifications'
import { handleContractFromBot, looksLikeContract, pnlMessage } from '@/lib/bot-call'
import { leaderboardMessage } from '@/lib/bot-leaderboard'
import { esc, tgCall, tgSend, type InlineButton, type TelegramConfig, type TgMessage } from '@/lib/telegram'
import { isLang, langFromLocale, t, type Lang } from '@/lib/bot-i18n'
import { isReminderLead, toggleLead } from '@/lib/notify-types'
import { fixedXLinks } from '@/lib/fix-links'
import { trackBotCommand } from '@/lib/bot-log'

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
 *  /pnl <CA>          tarjeta con el resultado de tu call de ese token
 *  /leaderboard [per] ranking de la comunidad (o de Cabal, en privado)
 *  /filter [CA|$TICKER|off] avisos solo de ciertos tokens
 *  /unlink            deja de mandar avisos a este chat
 *  /help
 *
 * Solo quien vinculó el chat o un administrador del grupo puede cambiar los
 * ajustes, el idioma o desvincularlo.
 */

type TgUser = { id: number; is_bot?: boolean; username?: string; first_name?: string; language_code?: string }
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

/** Comandos que atiende el bot (los que pasan por el registro de lib/bot-log). */
const TRACKED_COMMANDS = new Set(['start', 'link', 'settings', 'language', 'upcoming', 'call', 'pnl', 'leaderboard', 'filter', 'unlink', 'help'])

/** Alias en español de antes de pasar los comandos a inglés: siguen funcionando. */
const COMMAND_ALIASES: Record<string, string> = {
  vincular: 'link',
  ajustes: 'settings',
  config: 'settings',
  proximos: 'upcoming',
  llamada: 'call',
  ranking: 'leaderboard',
  lb: 'leaderboard',
  filtro: 'filter',
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
  if (!text) return
  // Un contrato pegado suelto vale como call: ver onPastedContract
  if (!text.startsWith('/')) {
    await onXLinks(tg, msg, text)
    return onPastedContract(tg, msg, text)
  }
  const [rawCmd, ...args] = text.split(/\s+/)
  const [name, mention] = rawCmd.slice(1).toLowerCase().split('@')
  // En grupos, un comando dirigido a otro bot no es para nosotros
  if (mention && mention !== tg.username.toLowerCase()) return
  const cmd = COMMAND_ALIASES[name] ?? name

  const chat = await findChat(msg.chat.id)
  const lang: Lang = chat ? (isLang(chat.lang) ? chat.lang : 'es') : langFromLocale(msg.from?.language_code)
  const tx = t(lang)
  const reply: Reply = (m) => tgSend(tg.token, String(msg.chat.id), typeof m === 'string' ? { text: m } : m)

  // Solo se registran nuestros comandos: en grupos llegan también los de otros bots
  if (!TRACKED_COMMANDS.has(cmd)) return
  await trackBotCommand(
    { provider: 'telegram', command: cmd, chatId: String(msg.chat.id), actorId: msg.from ? String(msg.from.id) : null },
    async () => {
      switch (cmd) {
        case 'start':
        case 'link':
          // ?startgroup=true (sin código) llega como "/start true"
          return args[0] && args[0] !== 'true' ? link(tg, msg, args[0], reply) : reply(welcomeMessage(msg.chat.type === 'private', 'telegram', lang))
        case 'settings':
          if (!chat || !chat.active) return reply(tx.notLinked(`${siteUrl()}/app`, 'telegram'))
          return reply({ text: tx.settingsTitle, buttons: settingsButtons(chat, lang, 'telegram') })
        case 'language':
          if (chat && !(await canManage(tg, chat, msg.chat, msg.from))) return reply(tx.onlyAdminChanges)
          return reply({ text: tx.languagePrompt, buttons: [languageButtons()] })
        case 'upcoming':
          return reply(await upcomingMessage(lang))
        case 'call': {
          if (!args[0]) return reply(tx.callUsage)
          const { message } = await handleContractFromBot({
            provider: 'telegram',
            actorId: msg.from ? String(msg.from.id) : null,
            chat,
            contract: args[0],
            note: args.slice(1).join(' '),
            lang,
            mode: 'command',
          })
          return message ? reply(message) : undefined
        }
        case 'pnl': {
          if (!args[0]) return reply(tx.pnlUsage)
          return reply(
            await pnlMessage({ provider: 'telegram', actorId: msg.from ? String(msg.from.id) : null, contract: args[0], lang })
          )
        }
        case 'leaderboard':
          return reply(await leaderboardMessage(chat, args[0] ?? null, lang))
        case 'filter':
          if (!chat || !chat.active) return reply(tx.notLinked(`${siteUrl()}/app`, 'telegram'))
          if (args[0] && !(await canManage(tg, chat, msg.chat, msg.from))) return reply(tx.onlyAdminChanges)
          return reply(await filterCommand(chat, args[0] ?? null, lang))
        case 'unlink':
          if (!chat) return reply(tx.notLinked(`${siteUrl()}/app`, 'telegram'))
          if (!(await canManage(tg, chat, msg.chat, msg.from))) return reply(tx.onlyManagerUnlinks)
          await db.chatLink.delete({ where: { id: chat.id } })
          return reply(tx.unlinked)
        case 'help':
          return reply(welcomeMessage(msg.chat.type === 'private', 'telegram', lang))
      }
    },
    (ref) => reply(tx.botError(ref))
  )
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
    buttons: settingsButtons(chat, lang, 'telegram'),
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
      reply_markup: { inline_keyboard: chat ? settingsButtons(chat, value, 'telegram') : welcomeMessage(q.message.chat.type === 'private', 'telegram', value).buttons },
    }).catch(() => {})
    return answer(tx.languageSet)
  }

  // Navegación entre la pantalla de ajustes y la de antelación
  if (kind === 'menu') {
    const tx = t(lang)
    if (!chat) return answer(tx.noLongerLinked)
    const toLead = value === 'lead'
    await editSettings(tg, q.message, toLead ? tx.leadTitle : tx.settingsTitle, toLead ? leadMenuButtons(chat, lang) : settingsButtons(chat, lang, 'telegram'))
    return answer()
  }

  if (kind === 'lead') {
    const minutes = Number(value)
    const tx = t(lang)
    if (!chat) return answer(tx.noLongerLinked)
    if (!isReminderLead(minutes)) return answer()
    if (!(await canManage(tg, chat, q.message.chat, q.from))) return answer(tx.onlyAdminChanges)
    const leads = toggleLead(chat.reminderLeads, minutes)
    await setChatLeads(chat, leads)
    await editSettings(tg, q.message, tx.leadTitle, leadMenuButtons({ ...chat, reminderLeads: leads }, lang))
    return answer(tx.leadSet(leadSummary(leads)))
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
    reply_markup: { inline_keyboard: settingsButtons(updated, lang, 'telegram') },
  }).catch(() => {})
  return answer(`${tx.prefs[pref]}: ${updated[pref] ? tx.on : tx.off}`)
}

/** Reescribe el mensaje de ajustes con otra pantalla. */
async function editSettings(tg: TelegramConfig, msg: TgMsg, text: string, buttons: InlineButton[][]) {
  await tgCall(tg.token, 'editMessageText', {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: buttons },
  }).catch(() => {})
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


/**
 * Un mensaje normal (sin comando) en un chat vinculado: si trae un contrato, se
 * responde con la ficha del token y, si quien lo pegó tiene cuenta y nadie
 * había llamado ese token aquí, se publica la call.
 *
 * Telegram solo entrega estos mensajes si el bot tiene el modo privacidad
 * desactivado (@BotFather → /setprivacy → Disable) o es administrador del
 * grupo. Sin eso, este código no llega a ejecutarse nunca.
 */
async function onPastedContract(tg: TelegramConfig, msg: TgMsg, text: string) {
  // Solo en chats conectados con Cabal, y nunca respondiendo a otro bot
  if (msg.from?.is_bot) return
  const contract = findContract(text)
  if (!contract) return
  const chat = await findChat(msg.chat.id)
  if (!chat?.active) return

  const lang: Lang = isLang(chat.lang) ? chat.lang : langFromLocale(msg.from?.language_code)
  const { message } = await handleContractFromBot({
    provider: 'telegram',
    actorId: msg.from ? String(msg.from.id) : null,
    chat,
    contract,
    note: '',
    lang,
    mode: 'pasted',
  })
  if (message) await tgSend(tg.token, String(msg.chat.id), message)
}

/**
 * Enlaces de X pegados en un chat vinculado: se responde con cada post por
 * fixupx, que Telegram sí previsualiza (ver lib/fix-links). Uno por mensaje,
 * porque Telegram solo previsualiza el primer enlace de cada uno.
 */
async function onXLinks(tg: TelegramConfig, msg: TgMsg, text: string) {
  if (msg.from?.is_bot) return
  const links = fixedXLinks(text)
  if (links.length === 0) return
  const chat = await findChat(msg.chat.id)
  if (!chat?.active || !chat.fixLinks) return
  for (const link of links) {
    await tgSend(tg.token, String(msg.chat.id), { text: link, preview: true }).catch((e) =>
      console.error('[telegram-bot] fix link:', (e as Error).message)
    )
  }
}

/**
 * Primer contrato que aparece en un texto. El patrón es amplio a propósito
 * (una palabra en base58 larga puede no ser un CA), así que después se valida
 * con looksLikeContract y, más adelante, contra DexScreener.
 */
const CONTRACT_PATTERN = /(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/g

function findContract(text: string): string | null {
  for (const match of text.match(CONTRACT_PATTERN) ?? []) {
    if (looksLikeContract(match)) return match
  }
  return null
}
