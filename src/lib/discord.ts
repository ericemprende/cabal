import { db } from '@/lib/db'
import { siteUrl } from '@/lib/waitlist'
import { BOT_COMMANDS } from '@/lib/bot-i18n'
import { htmlToMarkdown, type BotButton, type BotMessage } from '@/lib/bot-message'

/**
 * Bot de Discord de Cabal: configuración y llamadas a la API REST.
 *
 * Igual que el de Telegram, el token se pega desde el panel admin y se guarda
 * en Setting (o llega por DISCORD_BOT_TOKEN, que manda sobre la BD). Con el
 * token se consulta la aplicación y de ahí salen el id y la `verify_key`
 * (la clave pública con la que se comprueba la firma de cada interacción), así
 * que el admin no tiene que copiar tres valores distintos.
 *
 * Diferencia importante con Telegram: la URL de interacciones NO se puede
 * registrar por API. El admin tiene que pegarla a mano en el portal de
 * desarrolladores de Discord; el panel se la muestra para copiar.
 */

const API = 'https://discord.com/api/v10'

const K = {
  token: 'discord_bot_token',
  appId: 'discord_app_id',
  publicKey: 'discord_public_key',
  username: 'discord_bot_username',
  enabled: 'discord_enabled',
  since: 'discord_enabled_at',
} as const

export type DiscordConfig = {
  token: string
  appId: string
  /** verify_key de la aplicación: valida la firma Ed25519 de las interacciones. */
  publicKey: string
  username: string
  /** Si el admin pausa el bot, no se manda nada (las interacciones se siguen atendiendo). */
  enabled: boolean
  /** Desde cuándo se difunden launches/tesis: lo anterior no se manda nunca. */
  since: Date
  fromEnv: boolean
}

export async function discordConfig(): Promise<DiscordConfig | null> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'discord_' } } })
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? ''
  const envToken = process.env.DISCORD_BOT_TOKEN?.trim() ?? ''
  const token = envToken || get(K.token)
  const appId = get(K.appId)
  const publicKey = get(K.publicKey)
  if (!token || !appId || !publicKey) return null
  const since = new Date(get(K.since) || 0)
  return {
    token,
    appId,
    publicKey,
    username: get(K.username),
    enabled: get(K.enabled) !== 'false',
    since: Number.isNaN(since.getTime()) ? new Date() : since,
    fromEnv: Boolean(envToken),
  }
}

export function discordInteractionsUrl(): string {
  return `${siteUrl()}/api/discord/interactions`
}

/**
 * Enlace para añadir el bot a un servidor: leer canales, escribir, poner
 * enlaces y crear invitaciones.
 *
 * Lo último es lo que permite que el servidor aparezca con botón "Unirme" en
 * el ranking de clanes: la API de Discord solo da un enlace propio si el
 * servidor tiene URL personalizada (nivel 3 de boosts), así que para el resto
 * el bot se crea una invitación permanente él mismo. Si el servidor añadió el
 * bot antes de que se pidiera este permiso, no lo tendrá: entonces el dueño
 * pega el enlace a mano desde sus chats.
 */
export function discordInviteUrl(appId: string): string {
  const permissions = 1 + 1024 + 2048 + 16384 // CREATE_INSTANT_INVITE + VIEW_CHANNEL + SEND_MESSAGES + EMBED_LINKS
  const params = new URLSearchParams({
    client_id: appId,
    scope: 'bot applications.commands',
    permissions: String(permissions),
  })
  return `https://discord.com/oauth2/authorize?${params}`
}

async function setSettings(values: Record<string, string>) {
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  )
}

type DiscordApplication = { id: string; name: string; verify_key: string; bot?: { username?: string } }

/**
 * Guarda el token (validándolo contra la aplicación) y registra los comandos.
 * Devuelve también la URL de interacciones, que el admin pega en el portal.
 */
export async function connectDiscordBot(token: string): Promise<{ username: string; appId: string }> {
  const app = await dcCall<DiscordApplication>(token, 'GET', '/oauth2/applications/@me')
  if (!app.verify_key) throw new DiscordApiError('La aplicación no devolvió su clave pública', 400)
  const current = await discordConfig()
  const username = app.bot?.username || app.name
  await setSettings({
    [K.token]: process.env.DISCORD_BOT_TOKEN?.trim() ? '' : token,
    [K.appId]: app.id,
    [K.publicKey]: app.verify_key,
    [K.username]: username,
    [K.enabled]: 'true',
    // Solo la primera vez: reconectar no debe reenviar lo publicado mientras tanto
    ...(current ? {} : { [K.since]: new Date().toISOString() }),
  })
  await registerDiscordCommands(token, app.id)
  return { username, appId: app.id }
}

/** Quita el bot: borra los comandos registrados y la configuración guardada. */
export async function disconnectDiscordBot() {
  const cfg = await discordConfig()
  if (cfg) await dcCall(cfg.token, 'PUT', `/applications/${cfg.appId}/commands`, []).catch(() => {})
  await db.setting.deleteMany({
    where: { key: { in: [K.token, K.appId, K.publicKey, K.username, K.enabled] } },
  })
}

export async function setDiscordEnabled(enabled: boolean) {
  await setSettings({ [K.enabled]: String(enabled) })
}

// ---------- Comandos ----------

/** Opción de texto de un comando (type 3 = STRING en la API de Discord). */
const opt = (name: string, en: string, es: string, required: boolean) => ({
  name,
  description: en,
  description_localizations: { 'es-ES': es, 'es-419': es },
  type: 3,
  required,
})

const CODE_OPT = opt('code', 'The code from Cabal → your profile → Discord', 'El código de Cabal → tu perfil → Discord', true)

/** Los periodos del leaderboard, como lista cerrada para que Discord los sugiera. */
const PERIOD_CHOICES = [
  { name: '24h', value: '24h' },
  { name: '7 days / 7 días', value: '7d' },
  { name: '30 days / 30 días', value: '30d' },
  { name: 'All time / Todo', value: 'all' },
]

/**
 * Argumentos de cada comando. En Telegram se escriben detrás del comando; aquí
 * Discord los pide como campos, así que hay que declararlos.
 */
const COMMAND_OPTIONS: Record<string, Record<string, unknown>[]> = {
  // Sin código, /start solo saluda: por eso el suyo no es obligatorio
  start: [{ ...CODE_OPT, required: false }],
  link: [CODE_OPT],
  // autocomplete: mientras se escribe, Discord pide sugerencias (discord-bot → onAutocomplete)
  call: [
    { ...opt('contract', 'Contract address (CA) of the token', 'Contrato (CA) del token', true), autocomplete: true },
    opt('note', 'Your thesis about the token (optional)', 'Tu tesis sobre el token (opcional)', false),
  ],
  filter: [
    opt(
      'token',
      'Contract, $TICKER or "off". Adds it, or removes it if already there',
      'Contrato, $TICKER u "off". Lo añade, o lo quita si ya estaba',
      false
    ),
  ],
  pnl: [{ ...opt('contract', 'Contract address (CA) of the token', 'Contrato (CA) del token', true), autocomplete: true }],
  leaderboard: [
    { ...opt('period', 'Period: 24h, 7d, 30d or all', 'Periodo: 24h, 7d, 30d o all', false), choices: PERIOD_CHOICES },
  ],
}

/**
 * Registra los comandos globales. `contexts` los habilita en los servidores y
 * en el privado con el bot, que es lo que admite un bot instalado en servidores
 * sin depender de que la aplicación tenga activado "User Install" en el portal.
 * No se pasa `integration_types`: Discord usa los que tenga la aplicación.
 */
export async function registerDiscordCommands(token: string, appId: string) {
  const byName = new Map(BOT_COMMANDS.es.map((c) => [c.command, c.description]))
  // /link no está en BOT_COMMANDS: en Telegram es un alias de /start escrito a mano
  const names = [...BOT_COMMANDS.en, { command: 'link', description: 'Connect this chat with your Cabal account' }]
  const commands = names.map((c) => ({
    name: c.command,
    description: c.description,
    description_localizations: {
      'es-ES': byName.get(c.command) ?? 'Conectar este chat con tu cuenta de Cabal',
      'es-419': byName.get(c.command) ?? 'Conectar este chat con tu cuenta de Cabal',
    },
    type: 1,
    contexts: [0, 1],
    ...(COMMAND_OPTIONS[c.command] ? { options: COMMAND_OPTIONS[c.command] } : {}),
  }))
  // Clic derecho en un mensaje → Apps → publica la call del contrato que trae
  const callFromMessage = {
    name: CALL_MESSAGE_COMMAND,
    name_localizations: { 'es-ES': 'Hacer call del token', 'es-419': 'Hacer call del token' },
    type: 3,
    contexts: [0, 1],
  }
  await dcCall(token, 'PUT', `/applications/${appId}/commands`, [...commands, callFromMessage])
}

/** Comando del menú contextual de mensajes que publica una call. */
export const CALL_MESSAGE_COMMAND = 'Call this token'

// ---------- API REST ----------

export class DiscordApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Código de error de Discord (10003 canal desconocido, 50013 sin permisos…). */
    public code?: number,
    public retryAfter?: number
  ) {
    super(message)
  }
  /** El canal ya no admite mensajes del bot: expulsado, sin permiso o borrado. */
  get chatGone(): boolean {
    if (this.status === 403 || this.status === 404) return true
    return [10003, 10004, 50001, 50013].includes(this.code ?? 0)
  }
}

export async function dcCall<T = unknown>(
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CabalArmyBot (https://cabal.army, 1.0)',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status === 204) return undefined as T
  const payload = (await res.json().catch(() => ({}))) as {
    message?: string
    code?: number
    retry_after?: number
  }
  if (!res.ok) {
    throw new DiscordApiError(
      payload.message ?? `Discord respondió ${res.status}`,
      res.status,
      payload.code,
      payload.retry_after
    )
  }
  return payload as T
}

/**
 * Reescribe la respuesta diferida de una interacción (la que se acusó con el
 * tipo 5). Va contra el webhook de la interacción, que se autentica con su
 * propio token y no con el del bot; por eso no lleva cabecera Authorization.
 * El token vale 15 minutos.
 */
export async function editInteractionReply(appId: string, interactionToken: string, msg: BotMessage): Promise<void> {
  const res = await fetch(`${API}/webhooks/${appId}/${interactionToken}/messages/@original`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...toDiscordPayload(msg), allowed_mentions: { parse: [] as string[] } }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: number }
    throw new DiscordApiError(body.message ?? `Discord respondió ${res.status}`, res.status, body.code)
  }
}

/** Abre (o recupera) el canal privado del bot con un usuario. */
export async function openDmChannel(token: string, userId: string): Promise<string> {
  const ch = await dcCall<{ id: string }>(token, 'POST', '/users/@me/channels', { recipient_id: userId })
  return ch.id
}

// ---------- Mensajes ----------

/**
 * Pasa un mensaje de bot a lo que entiende Discord. Los botones con `url` son
 * botones de enlace (estilo 5) y los de `callback_data` botones normales cuyo
 * custom_id atiende /api/discord/interactions.
 */
export function toDiscordPayload(msg: BotMessage): { content: string; components?: unknown[]; embeds?: unknown[] } {
  const rows = (msg.buttons ?? [])
    .map((row) => row.slice(0, 5).map(toComponent).filter(Boolean))
    .filter((row) => row.length > 0)
    .slice(0, 5)
  return {
    content: htmlToMarkdown(msg.text).slice(0, 2000),
    ...(msg.image ? { embeds: [{ image: { url: msg.image } }] } : {}),
    ...(rows.length ? { components: rows.map((components) => ({ type: 1, components })) } : {}),
  }
}

function toComponent(b: BotButton) {
  const label = b.text.slice(0, 80)
  if (b.url) return { type: 2, style: 5, label, url: b.url }
  if (b.callback_data) return { type: 2, style: 2, label, custom_id: b.callback_data.slice(0, 100) }
  return null
}

/**
 * Envía un mensaje a un canal. Reintenta una vez si Discord pide esperar (429).
 * `allowed_mentions` vacío: el bot nunca hace ping a nadie con un aviso.
 */
export async function dcSend(token: string, channelId: string, msg: BotMessage): Promise<void> {
  const body = { ...toDiscordPayload(msg), allowed_mentions: { parse: [] as string[] } }
  try {
    await dcCall(token, 'POST', `/channels/${channelId}/messages`, body)
  } catch (e) {
    if (!(e instanceof DiscordApiError) || !e.retryAfter) throw e
    await new Promise((r) => setTimeout(r, Math.min(e.retryAfter ?? 1, 30) * 1000))
    await dcCall(token, 'POST', `/channels/${channelId}/messages`, body)
  }
}
