// Tipos compartidos (servidor y cliente) de la campanita y los chats vinculados.

export type BotProviderName = 'telegram' | 'discord'

export type ChatLinkDTO = {
  id: string
  provider: BotProviderName
  chatType: string // private | group | supergroup | channel
  lang: 'es' | 'en' // idioma de los mensajes del bot en este chat
  title: string | null
  notifyLaunches: boolean
  notifyReminders: boolean
  notifyTheses: boolean
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
  /** Minutos de antelación con los que avisa la campanita. */
  leadMinutes: number
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
    /** Enlace para añadir el bot a un servidor. */
    invite: string | null
    /** Servidores distintos donde hay algún canal conectado. */
    servers: number
  }
  /** Launches futuros con la campanita activa (no depende del proveedor). */
  reminders: number
  recent: { key: string; sentCount: number; createdAt: string }[]
}
