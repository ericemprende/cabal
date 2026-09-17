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
import { runNotificationTick } from '@/lib/notifications'
import type { AdminNotifyDTO } from '@/lib/notify-types'
import { t } from '@/lib/telegram-i18n'

function fail(e: unknown) {
  if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
  if (e instanceof TelegramApiError) {
    return NextResponse.json({ error: `Telegram: ${e.message}` }, { status: 400 })
  }
  return NextResponse.json({ error: (e as Error).message }, { status: 500 })
}

/** GET /api/admin/notifications — estado del bot de Telegram (y Discord, pendiente). */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const tg = await telegramConfig()
    const [privateChats, groups, channels, inactive, reminders, recent] = await Promise.all([
      db.chatLink.count({ where: { provider: 'telegram', active: true, chatType: 'private' } }),
      db.chatLink.count({ where: { provider: 'telegram', active: true, chatType: { in: ['group', 'supergroup'] } } }),
      db.chatLink.count({ where: { provider: 'telegram', active: true, chatType: 'channel' } }),
      db.chatLink.count({ where: { provider: 'telegram', active: false } }),
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
        webhookUrl: telegramWebhookUrl(),
        webhook,
        since: tg ? tg.since.toISOString() : null,
        stats: { privateChats, groups, channels, inactive, reminders },
      },
      discord: { configured: false },
      recent: recent.map((d) => ({ key: d.key, sentCount: d.sentCount, createdAt: d.createdAt.toISOString() })),
    }
    return NextResponse.json(dto)
  } catch (e) {
    return fail(e)
  }
}

/**
 * PUT /api/admin/notifications
 *   { token }            conecta el bot (valida el token y registra el webhook)
 *   { enabled: boolean } pausa o reanuda los envíos
 *   { disconnect: true } quita el bot
 * Con TELEGRAM_BOT_TOKEN en el servidor, { token: '' } conecta usando esa variable.
 */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))

    if (body.disconnect === true) {
      await disconnectTelegramBot()
      return NextResponse.json({ ok: true })
    }
    if (typeof body.enabled === 'boolean') {
      if (!(await telegramConfig())) return NextResponse.json({ error: 'Primero conecta el bot' }, { status: 400 })
      await setTelegramEnabled(body.enabled)
      return NextResponse.json({ ok: true })
    }
    if (typeof body.token === 'string') {
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
 *   { action: 'webhook' }              vuelve a registrar el webhook y los comandos
 *   { action: 'test', chatId? }        mensaje de prueba (sin chatId: a todos los privados de admins)
 *   { action: 'run' }                  ejecuta ya una pasada del worker
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const tg = await telegramConfig()
    if (!tg) return NextResponse.json({ error: 'Primero conecta el bot' }, { status: 400 })

    if (body.action === 'webhook') {
      await registerWebhook(tg.token, tg.webhookSecret)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'test') {
      const chats: { chatId: string; lang: string }[] = body.chatId
        ? [{ chatId: String(body.chatId), lang: 'es' }]
        : await db.chatLink.findMany({
            where: { provider: 'telegram', active: true, chatType: 'private', user: { isAdmin: true } },
            select: { chatId: true, lang: true },
          })
      if (chats.length === 0) {
        return NextResponse.json(
          { error: 'Ningún admin tiene su Telegram conectado. Conéctalo desde tu perfil o indica un chat id.' },
          { status: 400 }
        )
      }
      for (const c of chats) {
        await tgSend(tg.token, c.chatId, { text: t(c.lang).testMessage })
      }
      return NextResponse.json({ ok: true, sent: chats.length })
    }

    if (body.action === 'run') {
      return NextResponse.json({ ok: true, result: await runNotificationTick() })
    }

    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
  } catch (e) {
    return fail(e)
  }
}
