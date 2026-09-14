import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { pusherServer } from '@/lib/pusher-server'

/**
 * Autoriza la suscripción al canal de presencia `presence-cabal-global`.
 * Pusher hace el POST con `socket_id` + `channel_name` (form-encoded) antes
 * de dejar entrar al cliente; el `user_info` que devolvemos aquí es lo que
 * todos los demás ven en el evento `pusher:subscription_succeeded` /
 * `pusher:member_added` (nombre, avatar, handle → el puntico verde).
 */
export async function POST(req: Request) {
  if (!pusherServer) return NextResponse.json({ error: 'Chat en vivo no configurado' }, { status: 503 })
  try {
    const me = await getCurrentUser()
    const form = await req.formData()
    const socketId = String(form.get('socket_id') ?? '')
    const channel = String(form.get('channel_name') ?? '')
    if (!socketId || channel !== 'presence-cabal-global') {
      return NextResponse.json({ error: 'Canal inválido' }, { status: 400 })
    }
    const auth = pusherServer.authorizeChannel(socketId, channel, {
      user_id: me.id,
      user_info: { name: me.name, handle: me.handle, avatar: me.avatar },
    })
    return NextResponse.json(auth)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
