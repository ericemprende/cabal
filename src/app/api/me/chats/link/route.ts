import { NextResponse } from 'next/server'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { botLinks, telegramConfig } from '@/lib/telegram'
import { discordConfig, discordInviteUrl } from '@/lib/discord'
import { createLinkCode } from '@/lib/chat-links'
import { isBotProvider } from '@/lib/bot-message'
import type { ChatLinkCodeDTO } from '@/lib/notify-types'

/**
 * POST /api/me/chats/link — { provider: 'telegram' | 'discord' }
 * Genera un código de un solo uso (15 min). En Telegram el código viaja dentro
 * de los enlaces del bot (privado, grupo o canal); en Discord se escribe a mano
 * con /link, así que lo que se devuelve es el enlace para añadir el bot.
 */
export async function POST(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    const limit = await rateLimit(`chat-link:${userId}`, 10, 300)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const provider = body.provider ?? 'telegram'
    if (!isBotProvider(provider)) return NextResponse.json({ error: 'Proveedor desconocido' }, { status: 400 })

    if (provider === 'discord') {
      const dc = await discordConfig()
      if (!dc?.enabled) return NextResponse.json({ error: 'El bot de Discord no está activo todavía' }, { status: 503 })
      const { code, expiresAt } = await createLinkCode(userId, 'discord')
      const dto: ChatLinkCodeDTO = {
        provider: 'discord',
        code,
        expiresAt: expiresAt.toISOString(),
        invite: discordInviteUrl(dc.appId),
        botUsername: dc.username || null,
      }
      return NextResponse.json(dto)
    }

    const tg = await telegramConfig()
    if (!tg?.enabled) return NextResponse.json({ error: 'El bot de Telegram no está activo todavía' }, { status: 503 })
    const { code, expiresAt } = await createLinkCode(userId, 'telegram')
    const dto: ChatLinkCodeDTO = {
      provider: 'telegram',
      code,
      expiresAt: expiresAt.toISOString(),
      links: botLinks(tg.username, code),
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
