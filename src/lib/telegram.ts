import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { siteUrl } from '@/lib/waitlist'
import { BOT_COMMANDS } from '@/lib/bot-i18n'
import { esc, type BotButton, type BotMessage } from '@/lib/bot-message'

/**
 * Bot de Telegram de Cabal: configuración y llamadas a la Bot API.
 *
 * El token se pega desde el panel admin y se guarda en Setting (o llega por
 * la variable TELEGRAM_BOT_TOKEN, que manda sobre la BD). Al guardarlo se
 * registra el webhook en /api/telegram/webhook con un secreto propio: Telegram
 * lo devuelve en la cabecera X-Telegram-Bot-Api-Secret-Token y así nadie más
 * puede hacerse pasar por Telegram contra esa ruta.
 */

const K = {
  token: 'telegram_bot_token',
  username: 'telegram_bot_username',
  secret: 'telegram_webhook_secret',
  enabled: 'telegram_enabled',
  since: 'telegram_enabled_at',
} as const

export type TelegramConfig = {
  token: string
  username: string
  webhookSecret: string
  /** Si el admin pausa el bot, no se manda nada (el webhook sigue respondiendo). */
  enabled: boolean
  /** Desde cuándo se difunden launches/tesis: lo anterior no se manda nunca. */
  since: Date
  fromEnv: boolean
}

export async function telegramConfig(): Promise<TelegramConfig | null> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'telegram_' } } })
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? ''
  const envToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? ''
  const token = envToken || get(K.token)
  const username = get(K.username)
  if (!token || !username) return null
  const since = new Date(get(K.since) || 0)
  return {
    token,
    username,
    webhookSecret: get(K.secret),
    enabled: get(K.enabled) !== 'false',
    since: Number.isNaN(since.getTime()) ? new Date() : since,
    fromEnv: Boolean(envToken),
  }
}

export function telegramWebhookUrl(): string {
  return `${siteUrl()}/api/telegram/webhook`
}

async function setSettings(values: Record<string, string>) {
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  )
}

/**
 * Guarda el token (validándolo con getMe), registra el webhook y los comandos.
 * Si el token es el mismo que ya había, solo vuelve a registrar el webhook.
 */
export async function connectTelegramBot(token: string): Promise<{ username: string }> {
  const me = await tgCall<{ username: string; can_join_groups: boolean }>(token, 'getMe', {})
  const current = await telegramConfig()
  const secret = current?.token === token && current.webhookSecret ? current.webhookSecret : randomBytes(24).toString('hex')
  await setSettings({
    [K.token]: process.env.TELEGRAM_BOT_TOKEN?.trim() ? '' : token,
    [K.username]: me.username,
    [K.secret]: secret,
    [K.enabled]: 'true',
    // Solo la primera vez: reconectar no debe reenviar lo publicado mientras tanto
    ...(current ? {} : { [K.since]: new Date().toISOString() }),
  })
  await registerWebhook(token, secret)
  return { username: me.username }
}

export async function registerWebhook(token: string, secret: string) {
  await tgCall(token, 'setWebhook', {
    url: telegramWebhookUrl(),
    secret_token: secret,
    allowed_updates: ['message', 'channel_post', 'callback_query', 'my_chat_member'],
    drop_pending_updates: true,
  })
  // Mismos comandos (en inglés); la descripción del menú sale en el idioma de la app de Telegram
  await tgCall(token, 'setMyCommands', { commands: BOT_COMMANDS.en })
  await tgCall(token, 'setMyCommands', { commands: BOT_COMMANDS.es, language_code: 'es' })
}

/** Quita el bot: borra el webhook en Telegram y la configuración guardada. */
export async function disconnectTelegramBot() {
  const cfg = await telegramConfig()
  if (cfg) await tgCall(cfg.token, 'deleteWebhook', {}).catch(() => {})
  await db.setting.deleteMany({ where: { key: { in: [K.token, K.username, K.secret, K.enabled] } } })
}

export async function setTelegramEnabled(enabled: boolean) {
  await setSettings({ [K.enabled]: String(enabled) })
}

// ---------- Bot API ----------

export class TelegramApiError extends Error {
  constructor(
    message: string,
    public code: number,
    public retryAfter?: number,
    public migrateToChatId?: number
  ) {
    super(message)
  }
  /** El chat ya no admite mensajes del bot: expulsado, bloqueado o borrado. */
  get chatGone(): boolean {
    return this.code === 403 || (this.code === 400 && /chat not found|group chat was deactivated|not enough rights/i.test(this.message))
  }
}

export async function tgCall<T = unknown>(token: string, method: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    result?: T
    description?: string
    error_code?: number
    parameters?: { retry_after?: number; migrate_to_chat_id?: number }
  }
  if (!body.ok) {
    throw new TelegramApiError(
      body.description ?? `Telegram respondió ${res.status}`,
      body.error_code ?? res.status,
      body.parameters?.retry_after,
      body.parameters?.migrate_to_chat_id
    )
  }
  return body.result as T
}

// El mensaje de un bot es el mismo para Telegram y Discord: ver lib/bot-message.
export type InlineButton = BotButton
export type TgMessage = BotMessage
export { esc }

/**
 * Envía un mensaje HTML. Reintenta una vez si Telegram pide esperar (429) o
 * si el grupo pasó a supergrupo (devuelve el chat nuevo en `migratedTo`).
 */
export async function tgSend(
  token: string,
  chatId: string,
  msg: TgMessage
): Promise<{ migratedTo?: string }> {
  const params = (id: string) => ({
    chat_id: id,
    text: msg.text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(msg.buttons ? { reply_markup: { inline_keyboard: msg.buttons } } : {}),
  })
  try {
    await tgCall(token, 'sendMessage', params(chatId))
    return {}
  } catch (e) {
    if (!(e instanceof TelegramApiError)) throw e
    if (e.retryAfter) {
      await sleep(Math.min(e.retryAfter, 30) * 1000)
      await tgCall(token, 'sendMessage', params(chatId))
      return {}
    }
    if (e.migrateToChatId) {
      const to = String(e.migrateToChatId)
      await tgCall(token, 'sendMessage', params(to))
      return { migratedTo: to }
    }
    throw e
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function botLinks(username: string, code?: string) {
  return {
    bot: `https://t.me/${username}`,
    private: code ? `https://t.me/${username}?start=${code}` : `https://t.me/${username}`,
    // admin=… pide al usuario que le dé esos permisos al añadirlo
    group: code ? `https://t.me/${username}?startgroup=${code}&admin=post_messages` : `https://t.me/${username}?startgroup=true`,
    channel: `https://t.me/${username}?startchannel=true&admin=post_messages`,
  }
}
