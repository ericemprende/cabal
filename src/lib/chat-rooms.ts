/**
 * Salas del chat en vivo: una por idioma. La gente salta entre ellas con las
 * banderitas y cada sala tiene su propio historial, su propio contador de no
 * leídos y su propio eco en vivo.
 *
 * Es una sala por idioma y no una traducción automática a propósito: en un
 * chat de cripto el argot no sobrevive a un traductor, y quien escribe quiere
 * saber quién le está leyendo.
 */
export const CHAT_ROOMS = ['es', 'en'] as const
export type ChatRoom = (typeof CHAT_ROOMS)[number]

export const DEFAULT_CHAT_ROOM: ChatRoom = 'es'

export function isChatRoom(v: unknown): v is ChatRoom {
  return typeof v === 'string' && (CHAT_ROOMS as readonly string[]).includes(v)
}

/** Lo que llega por la red, saneado; cualquier otra cosa cae en español. */
export function toChatRoom(v: unknown): ChatRoom {
  return isChatRoom(v) ? v : DEFAULT_CHAT_ROOM
}

export const CHAT_ROOM_META: Record<ChatRoom, { flag: string; label: string; short: string }> = {
  es: { flag: '🇪🇸', label: 'Español', short: 'ES' },
  en: { flag: '🇬🇧', label: 'English', short: 'EN' },
}
