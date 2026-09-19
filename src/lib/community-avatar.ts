import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { telegramConfig, tgCall } from '@/lib/telegram'

/**
 * Foto de un grupo o canal de Telegram, para la tarjeta de su clan.
 *
 * En Discord el icono del servidor tiene URL pública (cdn.discordapp.com) y se
 * usa tal cual. En Telegram no: la foto solo se descarga con el token del bot,
 * que no puede salir al navegador. Así que se descarga aquí, se guarda en el
 * volumen persistente y se sirve desde /api/bot-avatar/<chatId>.
 */

const DIR = path.join(process.cwd(), 'upload', 'img', 'community')
/** Cada cuánto se vuelve a pedir la foto (los grupos la cambian poco). */
const TTL_MS = 24 * 60 * 60_000
const MAX_BYTES = 5 * 1024 * 1024
const SIDE = 160

/** Un chatId de Telegram: número, casi siempre negativo en grupos y canales. */
export function isTelegramChatId(v: string): boolean {
  return /^-?\d{1,20}$/.test(v)
}

function fileFor(chatId: string): string {
  return path.join(DIR, `tg-${chatId.replace('-', 'n')}.webp`)
}

async function download(chatId: string): Promise<Buffer | null> {
  const tg = await telegramConfig()
  if (!tg) return null
  const chat = await tgCall<{ photo?: { small_file_id?: string; big_file_id?: string } }>(tg.token, 'getChat', {
    chat_id: chatId,
  }).catch(() => null)
  const fileId = chat?.photo?.big_file_id ?? chat?.photo?.small_file_id
  if (!fileId) return null
  const file = await tgCall<{ file_path?: string }>(tg.token, 'getFile', { file_id: fileId }).catch(() => null)
  if (!file?.file_path) return null
  const res = await fetch(`https://api.telegram.org/file/bot${tg.token}/${file.file_path}`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return null
  const raw = Buffer.from(await res.arrayBuffer())
  if (raw.length > MAX_BYTES) return null
  return sharp(raw).resize(SIDE, SIDE, { fit: 'cover' }).webp({ quality: 80 }).toBuffer()
}

/**
 * La foto del chat, de la copia local si está fresca. Devuelve null si el chat
 * no tiene foto, el bot ya no puede verlo o Telegram falla.
 *
 * `chatId` solo se acepta si es un grupo/canal activo con el bot: así este
 * endpoint no sirve para que alguien haga que el servidor descargue lo que
 * quiera.
 */
export async function telegramChatPhoto(chatId: string): Promise<Buffer | null> {
  if (!isTelegramChatId(chatId)) return null
  const known = await db.chatLink.findFirst({
    where: { provider: 'telegram', chatId, chatType: { not: 'private' }, active: true },
    select: { id: true },
  })
  if (!known) return null

  const file = fileFor(chatId)
  const cached = await stat(file).catch(() => null)
  if (cached && Date.now() - cached.mtimeMs < TTL_MS) return readFile(file).catch(() => null)

  const fresh = await download(chatId).catch(() => null)
  if (!fresh) return cached ? readFile(file).catch(() => null) : null
  await mkdir(DIR, { recursive: true })
  await writeFile(file, fresh).catch(() => {})
  return fresh
}
