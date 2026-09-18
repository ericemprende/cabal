import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { chatMessageInclude, toChatMessageDTO } from '@/lib/chat'

/**
 * GET /api/me/chat-replies — últimas respuestas que otros dejaron a mis
 * mensajes del chat en vivo (para la campanita). Se leen directo de
 * ChatMessage; qué ya vio el usuario se guarda en su navegador.
 */
export async function GET() {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json([])
    const rows = await db.chatMessage.findMany({
      where: {
        replyTo: { userId },
        userId: { not: userId },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: chatMessageInclude,
    })
    return NextResponse.json(rows.map(toChatMessageDTO))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
