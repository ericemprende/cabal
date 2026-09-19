import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { pusherServer, CHAT_CHANNEL, CHAT_LIKE_EVENT } from '@/lib/pusher-server'

/**
 * POST /api/chat/messages/:id/like — pone o quita tu "me gusta" (corazón) en
 * un mensaje del chat en vivo. Devuelve { id, likedBy } y lo retransmite por
 * Pusher para que el corazón se actualice en todos los chats abiertos.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión para reaccionar' }, { status: 401 })

    const limit = await rateLimit(`chat-like:${userId}`, 60, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const { id } = await params
    const msg = await db.chatMessage.findUnique({ where: { id }, select: { id: true } })
    if (!msg) return NextResponse.json({ error: 'El mensaje ya no existe' }, { status: 404 })

    const key = { messageId_userId: { messageId: id, userId } }
    const existing = await db.chatMessageLike.findUnique({ where: key, select: { id: true } })
    if (existing) await db.chatMessageLike.delete({ where: key }).catch(() => {})
    else await db.chatMessageLike.create({ data: { messageId: id, userId } }).catch(() => {})

    const likes = await db.chatMessageLike.findMany({ where: { messageId: id }, select: { userId: true } })
    const payload = { id, likedBy: likes.map((l) => l.userId) }
    if (pusherServer) await pusherServer.trigger(CHAT_CHANNEL, CHAT_LIKE_EVENT, payload).catch(() => {})
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
