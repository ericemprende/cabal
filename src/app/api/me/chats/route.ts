import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { telegramConfig } from '@/lib/telegram'
import { toChatLinkDTO } from '@/lib/chat-links'
import type { MyChatsDTO } from '@/lib/notify-types'

/** GET /api/me/chats — chats de Telegram/Discord conectados a la cuenta. */
export async function GET() {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    const [tg, chats] = await Promise.all([
      telegramConfig(),
      db.chatLink.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ])
    const dto: MyChatsDTO = {
      telegram: { configured: Boolean(tg?.enabled), botUsername: tg?.username ?? null },
      discord: { configured: false },
      chats: chats.map(toChatLinkDTO),
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
