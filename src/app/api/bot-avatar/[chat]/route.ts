import { NextResponse } from 'next/server'
import { telegramChatPhoto } from '@/lib/community-avatar'

export const runtime = 'nodejs'

/**
 * GET /api/bot-avatar/<chatId> — foto de un grupo o canal de Telegram con el
 * bot, para la tarjeta de su clan (ver lib/community-avatar). Público: la foto
 * de un grupo ya la ve cualquiera que abra su enlace.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ chat: string }> }) {
  const { chat } = await ctx.params
  const photo = await telegramChatPhoto(chat).catch(() => null)
  if (!photo) {
    // Sin foto, la tarjeta enseña el icono del proveedor
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=600' } })
  }
  return new NextResponse(new Uint8Array(photo), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
