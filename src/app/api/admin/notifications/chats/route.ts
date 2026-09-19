import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { listBotChats } from '@/lib/bot-audience'
import { isBotProvider } from '@/lib/bot-message'

/**
 * GET /api/admin/notifications/chats?provider=telegram|discord[&fresh=1]
 * Chats conectados a ese bot con sus miembros y el alcance total.
 * fresh=1 vuelve a preguntar a Telegram/Discord en vez de usar la caché de 1 h.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const url = new URL(req.url)
    const provider = url.searchParams.get('provider') ?? 'telegram'
    if (!isBotProvider(provider)) return NextResponse.json({ error: 'Proveedor desconocido' }, { status: 400 })
    return NextResponse.json(await listBotChats(provider, url.searchParams.get('fresh') === '1'))
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
