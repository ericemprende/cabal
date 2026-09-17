import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { telegramConfig } from '@/lib/telegram'
import { handleTelegramUpdate, type TgUpdate } from '@/lib/telegram-bot'

/**
 * POST /api/telegram/webhook — updates del bot. Telegram manda el secreto
 * registrado en setWebhook en X-Telegram-Bot-Api-Secret-Token; sin él (o con
 * otro) no se procesa nada.
 *
 * Siempre responde 200 salvo al rechazar: si respondiera error por un fallo
 * nuestro, Telegram reintentaría el mismo update una y otra vez.
 */
export async function POST(req: Request) {
  const cfg = await telegramConfig()
  if (!cfg?.webhookSecret) return NextResponse.json({ ok: false }, { status: 404 })

  const got = Buffer.from(req.headers.get('x-telegram-bot-api-secret-token') ?? '')
  const want = Buffer.from(cfg.webhookSecret)
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null
  if (update) {
    try {
      await handleTelegramUpdate(cfg, update)
    } catch (e) {
      console.error('[telegram] update', update.update_id, (e as Error).message)
    }
  }
  return NextResponse.json({ ok: true })
}
