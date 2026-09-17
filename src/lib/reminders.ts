import { db } from '@/lib/db'
import { telegramConfig } from '@/lib/telegram'
import { discordConfig } from '@/lib/discord'
import type { ReminderChannelsDTO } from '@/lib/notify-types'

/** Por dónde le llegaría hoy al usuario el aviso de la campanita. */
export async function reminderChannels(userId: string): Promise<ReminderChannelsDTO> {
  const [tg, dc, privateChats, user] = await Promise.all([
    telegramConfig(),
    discordConfig(),
    db.chatLink.groupBy({
      by: ['provider'],
      where: { userId, chatType: 'private', active: true },
      _count: true,
    }),
    db.user.findUnique({ where: { id: userId }, select: { emailVerified: true, email: true } }),
  ])
  const has = (provider: string) => privateChats.some((p) => p.provider === provider)
  return {
    telegram: Boolean(tg?.enabled) && has('telegram'),
    discord: Boolean(dc?.enabled) && has('discord'),
    email: Boolean(user?.emailVerified && user.email),
  }
}
