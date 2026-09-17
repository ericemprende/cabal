import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import {
  TelegramApiError,
  connectTelegramBot,
  disconnectTelegramBot,
  registerWebhook,
  setTelegramEnabled,
  telegramConfig,
  telegramWebhookUrl,
  tgCall,
  tgSend,
} from '@/lib/telegram'
import {
  DiscordApiError,
  connectDiscordBot,
  dcSend,
  discordConfig,
  discordInteractionsUrl,
  discordInviteUrl,
  disconnectDiscordBot,
  registerDiscordCommands,
  setDiscordEnabled,
} from '@/lib/discord'
import { discordGatewayStatus, resetDiscordGateway } from '@/lib/discord-gateway'
import { runNotificationTick } from '@/lib/notifications'
import { isBotProvider, type BotProvider } from '@/lib/bot-message'
import type { AdminBotDTO, AdminNotifyDTO } from '@/lib/notify-types'
import { t } from '@/lib/bot-i18n'

function fail(e: unknown) {
  if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
  if (e instanceof TelegramApiError) return NextResponse.json({ error: `Telegram: ${e.message}` }, { status: 400 })
  if (e instanceof DiscordApiError) return NextResponse.json({ error: `Discord: ${e.message}` }, { status: 400 })
  return NextResponse.json({ error: (e as Error).message }, { status: 500 })
}

/** Cuántos chats de cada tipo tiene conectado un bot. */
async function botStats(provider: BotProvider): Promise<AdminBotDTO['stats']> {
  const [privateChats, groups, channels, inactive] = await Promise.all([
    db.chatLink.count({ where: { provider, active: true, chatType: 'private' } }),
    db.chatLink.count({ where: { provider, active: true, chatType: { in: ['group', 'supergroup'] } } }),
    db.chatLink.count({ where: { provider, active: true, chatType: 'channel' } }),
    db.chatLink.count({ where: { provider, active: false } }),
  ])
  return { privateChats, groups, channels, inactive }
}

/** GET /api/admin/notifications — estado de los bots de Telegram y Discord. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const [tg, dc] = await Promise.all([telegramConfig(), discordConfig()])
    const [tgStats, dcStats, servers, reminders, recent] = await Promise.all([
      botStats('telegram'),
      botStats('discord'),
      db.chatLink.findMany({
        where: { provider: 'discord', active: true, serverId: { not: null } },
        distinct: ['serverId'],
        select: { serverId: true },
      }),
      db.launchReminder.count({ where: { launch: { launchAt: { gt: new Date() } } } }),
      db.notificationDispatch.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
    ])

    let webhook: AdminNotifyDTO['telegram']['webhook'] = null
    if (tg) {
      const info = await tgCall<{
        url: string
        pending_update_count: number
        last_error_message?: string
        last_error_date?: number
      }>(tg.token, 'getWebhookInfo', {}).catch(() => null)
      if (info) {
        webhook = {
          url: info.url,
          pendingUpdates: info.pending_update_count,
          lastError: info.last_error_message ?? null,
          lastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
        }
      }
    }

    const dto: AdminNotifyDTO = {
      telegram: {
        configured: Boolean(tg),
        enabled: Boolean(tg?.enabled),
        fromEnv: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
        botUsername: tg?.username ?? null,
        since: tg ? tg.since.toISOString() : null,
        stats: tgStats,
        webhookUrl: telegramWebhookUrl(),
        webhook,
      },
      discord: {
        configured: Boolean(dc),
        enabled: Boolean(dc?.enabled),
        fromEnv: Boolean(process.env.DISCORD_BOT_TOKEN?.trim()),
        botUsername: dc?.username ?? null,
        since: dc ? dc.since.toISOString() : null,
        stats: dcStats,
        interactionsUrl: discordInteractionsUrl(),
        gateway: await discordGatewayStatus(),
        invite: dc ? discordInviteUrl(dc.appId) : null,
        servers: servers.length,
      },
      reminders,
      recent: recent.map((d) => ({ key: d.key, sentCount: d.sentCount, createdAt: d.createdAt.toISOString() })),
    }
    return NextResponse.json(dto)
  } catch (e) {
    return fail(e)
  }
}

/**
 * PUT /api/admin/notifications — { provider: 'telegram' | 'discord', … }
 *   { token }            conecta el bot (valida el token y registra webhook/comandos)
 *   { enabled: boolean } pausa o reanuda los envíos
 *   { disconnect: true } quita el bot
 * Con TELEGRAM_BOT_TOKEN / DISCORD_BOT_TOKEN en el servidor, { token: '' }
 * conecta usando esa variable.
 */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const provider = body.provider ?? 'telegram'
    if (!isBotProvider(provider)) return NextResponse.json({ error: 'Proveedor desconocido' }, { status: 400 })
    const config = provider === 'discord' ? discordConfig : telegramConfig

    if (body.disconnect === true) {
      await (provider === 'discord' ? disconnectDiscordBot() : disconnectTelegramBot())
      return NextResponse.json({ ok: true })
    }
    if (typeof body.enabled === 'boolean') {
      if (!(await config())) return NextResponse.json({ error: 'Primero conecta el bot' }, { status: 400 })
      await (provider === 'discord' ? setDiscordEnabled(body.enabled) : setTelegramEnabled(body.enabled))
      return NextResponse.json({ ok: true })
    }
    if (typeof body.token === 'string') {
      if (provider === 'discord') {
        const token = body.token.trim() || process.env.DISCORD_BOT_TOKEN?.trim() || ''
        // Los tokens de bot de Discord son tres partes separadas por punto
        if (!/^[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}$/.test(token)) {
          return NextResponse.json({ error: 'Ese no parece un token de bot de Discord' }, { status: 400 })
        }
        const { username } = await connectDiscordBot(token)
        // El gateway vuelve a intentarlo con el token nuevo
        await resetDiscordGateway()
        return NextResponse.json({ ok: true, username })
      }
      const token = body.token.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim() || ''
      if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
        return NextResponse.json({ error: 'Ese no parece un token de bot (123456:ABC…)' }, { status: 400 })
      }
      const { username } = await connectTelegramBot(token)
      return NextResponse.json({ ok: true, username })
    }
    return NextResponse.json({ error: 'Nada que hacer' }, { status: 400 })
  } catch (e) {
    return fail(e)
  }
}

/**
 * POST /api/admin/notifications
 *   { action: 'refresh', provider }     Telegram: reregistra webhook y comandos.
 *                                       Discord: reregistra los comandos.
 *   { action: 'test', provider, chatId? } mensaje de prueba (sin chatId: a los
 *                                       privados de los admins de ese bot)
 *   { action: 'run' }                   ejecuta ya una pasada del worker
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))

    // La pasada del worker no es de un bot concreto: manda por los que estén activos
    if (body.action === 'run') {
      return NextResponse.json({ ok: true, result: await runNotificationTick() })
    }

    const provider = body.provider ?? 'telegram'
    if (!isBotProvider(provider)) return NextResponse.json({ error: 'Proveedor desconocido' }, { status: 400 })

    if (provider === 'discord') {
      const dc = await discordConfig()
      if (!dc) return NextResponse.json({ error: 'Primero conecta el bot' }, { status: 400 })

      if (body.action === 'refresh') {
        await registerDiscordCommands(dc.token, dc.appId)
        return NextResponse.json({ ok: true })
      }
      if (body.action === 'test') {
        const chats = await testTargets('discord', body.chatId)
        if (chats.length === 0) return noTestTarget('Discord')
        for (const c of chats) await dcSend(dc.token, c.chatId, { text: t(c.lang).testMessage })
        return NextResponse.json({ ok: true, sent: chats.length })
      }
    } else {
      const tg = await telegramConfig()
      if (!tg) return NextResponse.json({ error: 'Primero conecta el bot' }, { status: 400 })

      if (body.action === 'refresh') {
        await registerWebhook(tg.token, tg.webhookSecret)
        return NextResponse.json({ ok: true })
      }
      if (body.action === 'test') {
        const chats = await testTargets('telegram', body.chatId)
        if (chats.length === 0) return noTestTarget('Telegram')
        for (const c of chats) await tgSend(tg.token, c.chatId, { text: t(c.lang).testMessage })
        return NextResponse.json({ ok: true, sent: chats.length })
      }
    }

    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
  } catch (e) {
    return fail(e)
  }
}

function testTargets(provider: BotProvider, chatId?: string) {
  if (chatId) return Promise.resolve([{ chatId: String(chatId), lang: 'es' }])
  return db.chatLink.findMany({
    where: { provider, active: true, chatType: 'private', user: { isAdmin: true } },
    select: { chatId: true, lang: true },
  })
}

function noTestTarget(name: string) {
  return NextResponse.json(
    { error: `Ningún admin tiene su ${name} conectado. Conéctalo desde tu perfil o indica un id de chat.` },
    { status: 400 }
  )
}
