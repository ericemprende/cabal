import { db } from '@/lib/db'
import { chatMessageInclude as include, toChatMessageDTO as toDTO } from '@/lib/chat'
import { CHAT_CHANNEL, CHAT_EVENT, pusherServer } from '@/lib/pusher-server'
import type { ChatRoom } from '@/lib/chat-rooms'
import type { AdminChatAnnounceDTO, ChatMessageDTO } from '@/lib/types'

/**
 * Aviso automático del propio Cabal en el chat en vivo: cada X horas se
 * publica un mensaje (el recordatorio de donaciones, por defecto) firmado por
 * la cuenta oficial y con un botón de acción.
 *
 * El botón existe porque en el chat no se pintan enlaces: un link escrito a
 * mano se queda en texto plano (a propósito: en un chat de cripto, enlaces
 * ajenos en los que se puede hacer clic son una invitación al scam). El aviso
 * lleva su enlace en un campo aparte, así que solo es pulsable lo que pone el
 * admin. Con "donate" ni siquiera se sale de la app: abre el diálogo de
 * donaciones.
 *
 * Lo dispara el worker de avisos (lib/notify-worker → runNotificationTick),
 * que pasa cada 30 s; la marca del último envío vive en Setting, así que
 * reiniciar el servidor no adelanta ni repite nada.
 */

const K = {
  enabled: 'chat_announce_enabled',
  hours: 'chat_announce_hours',
  body: 'chat_announce_body',
  bodyEn: 'chat_announce_body_en',
  link: 'chat_announce_link',
  label: 'chat_announce_label',
  labelEn: 'chat_announce_label_en',
  onlyIfActive: 'chat_announce_only_active',
  last: 'chat_announce_last',
  userId: 'chat_announce_user_id',
} as const

/** Mismo límite que un mensaje normal del chat. */
export const MAX_ANNOUNCE_BODY = 500

const DEFAULTS = {
  body:
    'Cabal es gratis y sin anuncios, pero los servidores y los datos en vivo no lo son. ' +
    'Con 1 USDT ya estás aportando: lo que entra se va entero en mantener esto en pie. 🫡',
  bodyEn:
    'Cabal is free and ad-free, but servers and live data are not. ' +
    'One single USDT already helps: every cent that comes in goes into keeping this running. 🫡',
  link: 'donate',
  label: 'Donar a Cabal',
  labelEn: 'Donate to Cabal',
  hours: 24,
}

/** Handles con los que se intenta crear la cuenta oficial, en orden. */
const SYSTEM_HANDLES = ['cabal', 'cabal_oficial', 'cabal_army', 'cabal_bot']

const clampHours = (n: number) => Math.min(720, Math.max(1, Math.round(n)))

/**
 * Enlace válido para el botón: "donate" (diálogo de donaciones), una ruta
 * interna, una URL https, o "" para no poner botón. Cualquier otra cosa
 * (javascript:, data:…) se descarta.
 */
export function normalizeAnnounceLink(raw: string): string {
  const v = raw.trim()
  if (!v || v === 'donate') return v
  if (v.startsWith('/')) return v
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : ''
  } catch {
    return ''
  }
}

export async function chatAnnounceConfig(): Promise<AdminChatAnnounceDTO> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'chat_announce_' } } })
  const v = (key: string) => rows.find((r) => r.key === key)?.value
  const hours = clampHours(Number(v(K.hours)) || DEFAULTS.hours)
  const lastAt = v(K.last) ?? null
  return {
    enabled: v(K.enabled) === '1',
    hours,
    body: v(K.body) ?? DEFAULTS.body,
    bodyEn: v(K.bodyEn) ?? DEFAULTS.bodyEn,
    linkUrl: v(K.link) ?? DEFAULTS.link,
    linkLabel: v(K.label) ?? DEFAULTS.label,
    linkLabelEn: v(K.labelEn) ?? DEFAULTS.labelEn,
    onlyIfActive: v(K.onlyIfActive) !== '0',
    lastAt,
    nextAt: lastAt ? new Date(new Date(lastAt).getTime() + hours * 3_600_000).toISOString() : null,
  }
}

type ConfigPatch = Partial<
  Pick<
    AdminChatAnnounceDTO,
    'enabled' | 'hours' | 'body' | 'bodyEn' | 'linkUrl' | 'linkLabel' | 'linkLabelEn' | 'onlyIfActive'
  >
>

export async function saveChatAnnounceConfig(patch: ConfigPatch): Promise<AdminChatAnnounceDTO> {
  const before = await chatAnnounceConfig()
  const writes: { key: string; value: string }[] = []
  const put = (key: string, value: string) => writes.push({ key, value })

  if (typeof patch.enabled === 'boolean') put(K.enabled, patch.enabled ? '1' : '0')
  if (typeof patch.hours === 'number' && Number.isFinite(patch.hours)) put(K.hours, String(clampHours(patch.hours)))
  if (typeof patch.body === 'string') put(K.body, patch.body.trim().slice(0, MAX_ANNOUNCE_BODY))
  if (typeof patch.bodyEn === 'string') put(K.bodyEn, patch.bodyEn.trim().slice(0, MAX_ANNOUNCE_BODY))
  if (typeof patch.linkUrl === 'string') put(K.link, normalizeAnnounceLink(patch.linkUrl))
  if (typeof patch.linkLabel === 'string') put(K.label, patch.linkLabel.trim().slice(0, 40))
  if (typeof patch.linkLabelEn === 'string') put(K.labelEn, patch.linkLabelEn.trim().slice(0, 40))
  if (typeof patch.onlyIfActive === 'boolean') put(K.onlyIfActive, patch.onlyIfActive ? '1' : '0')

  // Al encenderlo por primera vez el reloj arranca ahora: si no, el primer
  // aviso saldría de golpe en la siguiente pasada, sin que nadie lo pida.
  // Para mandarlo ya está el botón "Enviar ahora".
  if (patch.enabled === true && !before.lastAt) put(K.last, new Date().toISOString())

  if (writes.length > 0) {
    await db.$transaction(
      writes.map((w) => db.setting.upsert({ where: { key: w.key }, update: { value: w.value }, create: w }))
    )
  }
  return chatAnnounceConfig()
}

/** Cuenta oficial que firma los avisos. Se crea sola la primera vez. */
async function systemUserId(): Promise<string> {
  const saved = await db.setting.findUnique({ where: { key: K.userId } })
  if (saved) {
    const u = await db.user.findUnique({ where: { id: saved.value }, select: { id: true } })
    if (u) return u.id
  }
  for (const handle of SYSTEM_HANDLES) {
    // Si el handle ya es de alguien, no publicamos en su nombre: se prueba el siguiente.
    if (await db.user.findUnique({ where: { handle }, select: { id: true } })) continue
    const user = await db.user.create({
      data: {
        handle,
        name: 'Cabal',
        avatar: '📣',
        bio: 'Cuenta oficial de Cabal',
        verified: true,
        verifiedVia: 'admin',
      },
      select: { id: true },
    })
    await db.setting.upsert({
      where: { key: K.userId },
      update: { value: user.id },
      create: { key: K.userId, value: user.id },
    })
    return user.id
  }
  throw new Error('No hay ningún handle libre para la cuenta oficial del chat')
}

/**
 * Publica el aviso si toca. `force` lo manda ya (botón "Enviar ahora" del
 * panel) sin mirar el reloj, pero igualmente reinicia la cuenta atrás.
 * Devuelve el mensaje publicado, o null si no tocaba.
 */
export async function postChatAnnouncement({ force = false } = {}): Promise<ChatMessageDTO | null> {
  const cfg = await chatAnnounceConfig()
  const body = cfg.body.trim()
  if (!body) return null

  const last = cfg.lastAt ? new Date(cfg.lastAt).getTime() : 0
  if (!force) {
    if (!cfg.enabled) return null
    if (last && Date.now() - last < cfg.hours * 3_600_000) return null
    // Chat muerto: recordar donaciones a nadie solo deja la pantalla llena de
    // avisos apilados. Se espera a que alguien vuelva a escribir.
    if (cfg.onlyIfActive && last) {
      const humans = await db.chatMessage.count({ where: { system: false, createdAt: { gt: new Date(last) } } })
      if (humans === 0) return null
    }
  }

  // La marca se escribe ANTES de publicar: si dos pasadas se solapan, la
  // segunda ya ve el reloj reiniciado y no duplica el aviso.
  const stamp = new Date().toISOString()
  await db.setting.upsert({
    where: { key: K.last },
    update: { value: stamp },
    create: { key: K.last, value: stamp },
  })

  const link = normalizeAnnounceLink(cfg.linkUrl)
  const userId = await systemUserId()

  // El aviso se publica en las dos salas, cada una en su idioma: quien está en
  // el chat en inglés no tiene por qué leer el recordatorio en español.
  const versions: { room: ChatRoom; body: string; label: string }[] = [
    { room: 'es', body, label: cfg.linkLabel.trim().slice(0, 40) || 'Abrir' },
    { room: 'en', body: (cfg.bodyEn.trim() || body).slice(0, MAX_ANNOUNCE_BODY), label: cfg.linkLabelEn.trim().slice(0, 40) || 'Open' },
  ]

  let first: ChatMessageDTO | null = null
  for (const v of versions) {
    const row = await db.chatMessage.create({
      data: {
        userId,
        room: v.room,
        body: v.body.slice(0, MAX_ANNOUNCE_BODY),
        system: true,
        linkUrl: link || null,
        linkLabel: link ? v.label : null,
      },
      include,
    })
    const dto = toDTO(row)
    first ??= dto
    // Sin Pusher el aviso queda guardado igual: se ve al recargar el historial.
    if (pusherServer) await pusherServer.trigger(CHAT_CHANNEL, CHAT_EVENT, dto).catch(() => {})
  }
  return first
}
