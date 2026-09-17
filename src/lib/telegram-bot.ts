import { db } from '@/lib/db'
import { CHAT_PREFS, consumeLinkCode, upsertChatLink, type ChatPref } from '@/lib/chat-links'
import { fmtLaunchDate, launchUrl } from '@/lib/notifications'
import { siteUrl } from '@/lib/waitlist'
import { esc, tgCall, tgSend, type TelegramConfig, type TgMessage } from '@/lib/telegram'

/**
 * Qué hace el bot con cada update que llega al webhook.
 *
 *  /start <código>      en privado: vincula el chat con la cuenta de Cabal
 *  /start@bot <código>  en un grupo (llega así al añadirlo con ?startgroup=)
 *  /vincular <código>   lo mismo, escrito a mano (grupos y canales)
 *  /ajustes             botones para elegir qué avisos llegan al chat
 *  /proximos            los próximos lanzamientos
 *  /desvincular         deja de mandar avisos a este chat
 *
 * Solo quien vinculó el chat o un administrador del grupo puede cambiar los
 * ajustes o desvincularlo.
 */

type TgUser = { id: number; username?: string; first_name?: string }
type TgChat = { id: number; type: string; title?: string; username?: string; first_name?: string }
type TgMsg = { message_id: number; chat: TgChat; from?: TgUser; text?: string; sender_chat?: TgChat; migrate_to_chat_id?: number }
export type TgUpdate = {
  update_id: number
  message?: TgMsg
  channel_post?: TgMsg
  callback_query?: { id: string; from: TgUser; message?: TgMsg; data?: string }
  my_chat_member?: { chat: TgChat; from: TgUser; new_chat_member: { status: string } }
}

const PREF_LABELS: Record<ChatPref, string> = {
  notifyLaunches: 'Lanzamientos nuevos',
  notifyReminders: 'Aviso 1 h antes de cada launch',
  notifyTheses: 'Tesis nuevas',
}

export async function handleTelegramUpdate(tg: TelegramConfig, u: TgUpdate) {
  if (u.callback_query) return onCallback(tg, u.callback_query)

  if (u.my_chat_member) {
    const { chat, new_chat_member } = u.my_chat_member
    if (['left', 'kicked'].includes(new_chat_member.status)) {
      await db.chatLink.updateMany({
        where: { provider: 'telegram', chatId: String(chat.id) },
        data: { active: false, lastError: 'El bot salió del chat' },
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
  const [cmd, mention] = rawCmd.slice(1).toLowerCase().split('@')
  // En grupos, un comando dirigido a otro bot no es para nosotros
  if (mention && mention !== tg.username.toLowerCase()) return

  const reply = (m: TgMessage | string) => tgSend(tg.token, String(msg.chat.id), typeof m === 'string' ? { text: m } : m)

  switch (cmd) {
    case 'start':
    case 'vincular':
      // ?startgroup=true (sin código) llega como "/start true"
      return args[0] && args[0] !== 'true' ? link(tg, msg, args[0], reply) : reply(welcome(msg.chat.type))
    case 'ajustes':
    case 'config':
      return settings(tg, msg, reply)
    case 'proximos':
      return reply(await upcoming())
    case 'desvincular':
      return unlink(tg, msg, reply)
    case 'ayuda':
    case 'help':
      return reply(welcome(msg.chat.type))
  }
}

async function link(tg: TelegramConfig, msg: TgMsg, code: string, reply: (m: TgMessage | string) => Promise<unknown>) {
  const isPrivate = msg.chat.type === 'private'
  // En grupos solo un admin del grupo puede conectarlo a una cuenta
  // (en canales no hay `from`: solo publican sus administradores; un admin
  // anónimo de un grupo escribe "como el grupo", con sender_chat = el chat)
  const anonymousAdmin = msg.sender_chat?.id === msg.chat.id
  if (!isPrivate && !anonymousAdmin && msg.from && !(await isChatAdmin(tg, msg.chat.id, msg.from.id))) {
    return reply('Solo un administrador del grupo puede conectarlo con Cabal.')
  }
  const user = await consumeLinkCode(code, 'telegram')
  if (!user) {
    return reply(
      `Ese código no vale o ya caducó. Genera uno nuevo en <a href="${siteUrl()}/app">Cabal</a> → tu perfil → Telegram.`
    )
  }
  const title = msg.chat.title ?? (msg.chat.username ? `@${msg.chat.username}` : msg.chat.first_name ?? null)
  const chat = await upsertChatLink({
    provider: 'telegram',
    chatId: String(msg.chat.id),
    chatType: msg.chat.type,
    title,
    userId: user.id,
    externalUserId: msg.from ? String(msg.from.id) : null,
  })
  if (isPrivate) {
    return reply({
      text: `✅ Listo, este chat está conectado con <b>@${esc(user.handle)}</b>.\n\nTe avisaré aquí de los launches en los que actives la 🔔 campanita, 1 hora antes. Si quieres además todos los lanzamientos o las tesis, usa /ajustes.`,
      buttons: prefButtons(chat),
    })
  }
  return reply({
    text: `✅ <b>${esc(title ?? 'Este chat')}</b> quedó conectado con Cabal (vinculado por @${esc(user.handle)}).\n\nElige qué avisos quieres recibir aquí:`,
    buttons: prefButtons(chat),
  })
}

async function settings(tg: TelegramConfig, msg: TgMsg, reply: (m: TgMessage | string) => Promise<unknown>) {
  const chat = await db.chatLink.findUnique({
    where: { provider_chatId: { provider: 'telegram', chatId: String(msg.chat.id) } },
  })
  if (!chat || !chat.active) return reply(notLinkedText())
  return reply({ text: '⚙️ <b>Avisos de este chat</b>\nToca para activar o desactivar:', buttons: prefButtons(chat) })
}

async function unlink(tg: TelegramConfig, msg: TgMsg, reply: (m: TgMessage | string) => Promise<unknown>) {
  const chat = await db.chatLink.findUnique({
    where: { provider_chatId: { provider: 'telegram', chatId: String(msg.chat.id) } },
  })
  if (!chat) return reply(notLinkedText())
  if (!(await canManage(tg, chat, msg.chat, msg.from))) return reply('Solo quien lo conectó o un administrador puede desvincularlo.')
  await db.chatLink.delete({ where: { id: chat.id } })
  return reply('Hecho: este chat ya no recibirá avisos de Cabal. Puedes volver a conectarlo cuando quieras desde tu perfil.')
}

async function onCallback(tg: TelegramConfig, q: NonNullable<TgUpdate['callback_query']>) {
  const answer = (text: string) => tgCall(tg.token, 'answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => {})
  const pref = q.data?.startsWith('pref:') ? (q.data.slice(5) as ChatPref) : null
  if (!pref || !CHAT_PREFS.includes(pref) || !q.message) return answer('')

  const chat = await db.chatLink.findUnique({
    where: { provider_chatId: { provider: 'telegram', chatId: String(q.message.chat.id) } },
  })
  if (!chat) return answer('Este chat ya no está conectado')
  if (!(await canManage(tg, chat, q.message.chat, q.from))) return answer('Solo un administrador puede cambiarlo')

  const updated = await db.chatLink.update({ where: { id: chat.id }, data: { [pref]: !chat[pref] } })
  await tgCall(tg.token, 'editMessageReplyMarkup', {
    chat_id: q.message.chat.id,
    message_id: q.message.message_id,
    reply_markup: { inline_keyboard: prefButtons(updated) },
  }).catch(() => {})
  return answer(`${PREF_LABELS[pref]}: ${updated[pref] ? 'activado' : 'desactivado'}`)
}

function prefButtons(chat: Record<ChatPref, boolean>) {
  return CHAT_PREFS.map((p) => [{ text: `${chat[p] ? '✅' : '⬜️'} ${PREF_LABELS[p]}`, callback_data: `pref:${p}` }])
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

async function upcoming(): Promise<TgMessage> {
  const launches = await db.launch.findMany({
    where: { hidden: false, launchAt: { gt: new Date() } },
    orderBy: { launchAt: 'asc' },
    take: 8,
    select: { id: true, name: true, ticker: true, isPrivate: true, launchAt: true, dateConfirmed: true },
  })
  if (launches.length === 0) return { text: 'No hay lanzamientos programados ahora mismo.' }
  const lines = launches.map((l) => {
    const label = l.ticker && !l.isPrivate ? `$${esc(l.ticker)} · ${esc(l.name)}` : esc(l.name)
    return `• <a href="${launchUrl(l.id)}">${label}</a> — ${fmtLaunchDate(l.launchAt)}${l.dateConfirmed ? '' : ' (estimada)'}`
  })
  return { text: `🗓 <b>Próximos lanzamientos</b>\n\n${lines.join('\n')}`, buttons: [[{ text: 'Ver todos en Cabal', url: `${siteUrl()}/app` }]] }
}

function notLinkedText(): string {
  return `Este chat no está conectado con Cabal. Entra en <a href="${siteUrl()}/app">Cabal</a> → tu perfil → Telegram y genera un enlace.`
}

function welcome(chatType: string): TgMessage {
  const where =
    chatType === 'private'
      ? 'Para conectarlo con tu cuenta entra en Cabal → tu perfil → <b>Telegram</b> → <b>Conectar mi Telegram</b>.'
      : 'Para recibir avisos aquí, un administrador genera un código en Cabal → perfil → <b>Telegram</b> → <b>Añadir a un grupo</b> y lo envía con <code>/vincular CÓDIGO</code>.'
  return {
    text: `👋 <b>Bot de Cabal</b>\n\nTe aviso de los lanzamientos, de los que están por salir y de las tesis de la comunidad, sin tener que estar mirando la web.\n\n${where}\n\n/proximos — próximos lanzamientos\n/ajustes — qué avisos llegan aquí\n/desvincular — dejar de recibir avisos`,
    buttons: [[{ text: 'Abrir Cabal', url: `${siteUrl()}/app` }]],
  }
}
