// Tipos compartidos (servidor y cliente) de la campanita y los chats vinculados.

export type BotProviderName = 'telegram' | 'discord'

/**
 * Antelaciones que se pueden elegir para el aviso de un lanzamiento, en
 * minutos. Es una lista cerrada a propósito: el worker recorre una vez cada
 * antelación en uso, así que dejar poner cualquier número multiplicaría el
 * trabajo de cada pasada sin que nadie lo note.
 */
export const REMINDER_LEADS = [5, 15, 30, 60, 180] as const
export type ReminderLead = (typeof REMINDER_LEADS)[number]
/** La de siempre: es la que tenían todos antes de poder elegir. */
export const DEFAULT_REMINDER_LEAD = 60

export function isReminderLead(v: unknown): v is ReminderLead {
  return typeof v === 'number' && (REMINDER_LEADS as readonly number[]).includes(v)
}

/**
 * Limpia una lista de antelaciones: solo valores conocidos, sin repetidos y de
 * mayor a menor. Nunca devuelve vacío — sin ninguna antelación, la campanita no
 * avisaría jamás y quedaría encendida sin hacer nada.
 */
/**
 * Enciende o apaga una antelación. Devuelve la lista tal cual si el cambio la
 * dejaría vacía: quedarse sin ninguna equivale a una campanita que no avisa.
 */
export function toggleLead(current: number[], minutes: number): number[] {
  const next = current.includes(minutes) ? current.filter((m) => m !== minutes) : [...current, minutes]
  return next.length ? next.sort((a, b) => b - a) : current
}

export function sanitizeLeads(input: unknown): number[] | null {
  if (!Array.isArray(input)) return null
  const clean = [...new Set(input.filter(isReminderLead))].sort((a, b) => b - a)
  return clean.length ? clean : null
}

export function leadLabel(min: number): string {
  if (min < 60) return `${min} min`
  const h = min / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`
}

export type ChatLinkDTO = {
  id: string
  provider: BotProviderName
  chatType: string // private | group | supergroup | channel
  lang: 'es' | 'en' // idioma de los mensajes del bot en este chat
  title: string | null
  notifyLaunches: boolean
  notifyReminders: boolean
  notifyTheses: boolean
  /** Antelaciones del aviso de lanzamiento en este chat, en minutos. */
  reminderLeads: number[]
  /** Difundir aquí las calls nuevas publicadas en Cabal. */
  notifyCalls: boolean
  /** Solo avisos de estos tokens (contratos o "$TICKER"). Vacío = todos. */
  tokenFilter: string[]
  /** Solo calls, tesis y lanzamientos de cuentas que sigue el dueño del chat. */
  onlyFollowing: boolean
  active: boolean
  lastError: string | null
  createdAt: string
}

/** Por dónde le llegaría hoy un aviso de la campanita al usuario. */
export type ReminderChannelsDTO = {
  telegram: boolean
  discord: boolean
  email: boolean
}

export type MyRemindersDTO = {
  launchIds: string[]
  channels: ReminderChannelsDTO
  /** Minutos de antelación con los que avisa la campanita (pueden ser varios). */
  leads: number[]
}

export type MyChatsDTO = {
  telegram: { configured: boolean; botUsername: string | null }
  discord: { configured: boolean; botUsername: string | null; invite: string | null }
  chats: ChatLinkDTO[]
}

/**
 * Código de un solo uso para vincular un chat. En Telegram el código viaja en
 * el enlace del bot; en Discord se escribe a mano con /link, así que lo que se
 * da es el enlace para añadir el bot y el propio código.
 */
export type TelegramLinkCodeDTO = {
  provider: 'telegram'
  code: string
  expiresAt: string
  links: { private: string; group: string; channel: string; bot: string }
}

export type DiscordLinkCodeDTO = {
  provider: 'discord'
  code: string
  expiresAt: string
  /** Enlace de OAuth para añadir el bot a un servidor. */
  invite: string
  botUsername: string | null
}

export type ChatLinkCodeDTO = TelegramLinkCodeDTO | DiscordLinkCodeDTO

/** Estado de un bot en el panel de administración. */
export type AdminBotDTO = {
  configured: boolean
  enabled: boolean
  /** El token viene de una variable de entorno: no se puede cambiar desde aquí. */
  fromEnv: boolean
  botUsername: string | null
  since: string | null
  stats: { privateChats: number; groups: number; channels: number; inactive: number }
}

export type AdminNotifyDTO = {
  telegram: AdminBotDTO & {
    webhookUrl: string
    webhook: { url: string; pendingUpdates: number; lastError: string | null; lastErrorAt: string | null } | null
  }
  discord: AdminBotDTO & {
    /** URL que el admin pega en el portal de Discord (no se puede registrar por API). */
    interactionsUrl: string
    /**
     * Conexión permanente que lee los contratos pegados en los canales. Sin el
     * permiso "Message Content" activado en el portal no conecta, y el error lo
     * dice aquí.
     */
    gateway: { connected: boolean; error: string | null }
    /** Enlace para añadir el bot a un servidor. */
    invite: string | null
    /** Servidores distintos donde hay algún canal conectado. */
    servers: number
  }
  /** Launches futuros con la campanita activa (no depende del proveedor). */
  reminders: number
  recent: { key: string; sentCount: number; createdAt: string }[]
}
