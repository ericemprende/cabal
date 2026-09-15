import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/api-helpers'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit'
import { pusherServer, CHAT_CHANNEL, CHAT_EVENT } from '@/lib/pusher-server'
import type { ChatMessageDTO } from '@/lib/types'

function toDTO(m: { id: string; body: string; createdAt: Date; user: { id: string; name: string; handle: string; avatar: string; walletVerified: boolean } }): ChatMessageDTO {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    user: {
      id: m.user.id,
      name: m.user.name,
      handle: m.user.handle,
      avatar: m.user.avatar,
      walletVerified: m.user.walletVerified,
    },
  }
}

const userSelect = { id: true, name: true, handle: true, avatar: true, walletVerified: true } as const

// Últimos mensajes del chat global (historial al entrar).
export async function GET() {
  try {
    const rows = await db.chatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: userSelect } },
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

    const row = await db.chatMessage.create({
      data: { userId: me.id, body: text },
      include: { user: { select: userSelect } },
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
