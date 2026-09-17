// Tipos compartidos (servidor y cliente) de la campanita y los chats vinculados.

export type ChatLinkDTO = {
  id: string
  provider: 'telegram' | 'discord'
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
  discord: { configured: boolean }
  chats: ChatLinkDTO[]
}

export type ChatLinkCodeDTO = {
  code: string
  expiresAt: string
  links: { private: string; group: string; channel: string; bot: string }
}

export type AdminNotifyDTO = {
  telegram: {
    configured: boolean
    enabled: boolean
    fromEnv: boolean
    botUsername: string | null
    webhookUrl: string
    webhook: { url: string; pendingUpdates: number; lastError: string | null; lastErrorAt: string | null } | null
    since: string | null
    stats: { privateChats: number; groups: number; channels: number; inactive: number; reminders: number }
  }
  discord: { configured: boolean }
  recent: { key: string; sentCount: number; createdAt: string }[]
}
