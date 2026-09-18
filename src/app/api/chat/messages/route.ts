import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/api-helpers'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { pusherServer, CHAT_CHANNEL, CHAT_EVENT } from '@/lib/pusher-server'
import { chatMessageInclude as include, toChatMessageDTO as toDTO } from '@/lib/chat'

// Últimos mensajes del chat global (historial al entrar).
export async function GET() {
  try {
    const rows = await db.chatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include,
    })
    return NextResponse.json(rows.reverse().map(toDTO))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()

    const limit = await rateLimit(`chat:${me.id ?? clientIp(req)}`, 20, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json()
    const text = typeof body?.body === 'string' ? body.body.trim() : ''
    if (!text) return NextResponse.json({ error: 'El mensaje está vacío' }, { status: 400 })
    if (text.length > 500) return NextResponse.json({ error: 'Máximo 500 caracteres' }, { status: 400 })

    // Solo se acepta responder a un mensaje que exista.
    let replyToId: string | null = null
    if (typeof body?.replyToId === 'string' && body.replyToId) {
      const target = await db.chatMessage.findUnique({ where: { id: body.replyToId }, select: { id: true } })
      if (!target) return NextResponse.json({ error: 'El mensaje al que respondes ya no existe' }, { status: 400 })
      replyToId = target.id
    }

    const row = await db.chatMessage.create({
      data: { userId: me.id, body: text, replyToId },
      include,
    })
    const dto = toDTO(row)

    // Si Pusher no está configurado el mensaje igual queda guardado; solo no
    // se retransmite en vivo (los demás lo verían al recargar el historial).
    if (pusherServer) {
      await pusherServer.trigger(CHAT_CHANNEL, CHAT_EVENT, dto).catch(() => {})
    }

    return NextResponse.json(dto, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
