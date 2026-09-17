import { db } from '@/lib/db'
import { telegramConfig } from '@/lib/telegram'
import type { ReminderChannelsDTO } from '@/lib/notify-types'

/** Por dónde le llegaría hoy al usuario el aviso de la campanita. */
export async function reminderChannels(userId: string): Promise<ReminderChannelsDTO> {
  const [tg, privateChats, user] = await Promise.all([
    telegramConfig(),
    db.chatLink.count({ where: { userId, provider: 'telegram', chatType: 'private', active: true } }),
    db.user.findUnique({ where: { id: userId }, select: { emailVerified: true, email: true } }),
  ])
  return {
    telegram: Boolean(tg?.enabled) && privateChats > 0,
    email: Boolean(user?.emailVerified && user.email),
  }
}
