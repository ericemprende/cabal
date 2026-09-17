import { NextResponse } from 'next/server'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { botLinks, telegramConfig } from '@/lib/telegram'
import { createLinkCode } from '@/lib/chat-links'
import type { ChatLinkCodeDTO } from '@/lib/notify-types'

/**
 * POST /api/me/chats/link — { provider: 'telegram' }
 * Genera un código de un solo uso (15 min) y los enlaces para abrir el bot
 * en privado o añadirlo a un grupo/canal con ese código.
 */
export async function POST(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    const limit = await rateLimit(`chat-link:${userId}`, 10, 300)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    if ((body.provider ?? 'telegram') !== 'telegram') {
      return NextResponse.json({ error: 'Discord todavía no está disponible' }, { status: 400 })
    }
    const tg = await telegramConfig()
    if (!tg?.enabled) return NextResponse.json({ error: 'El bot de Telegram no está activo todavía' }, { status: 503 })

    const { code, expiresAt } = await createLinkCode(userId, 'telegram')
    const dto: ChatLinkCodeDTO = { code, expiresAt: expiresAt.toISOString(), links: botLinks(tg.username, code) }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
