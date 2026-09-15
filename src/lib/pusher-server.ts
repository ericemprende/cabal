import Pusher from 'pusher'

/**
 * Cliente de Pusher del lado servidor: dispara eventos (mensajes de chat) y
 * autoriza la suscripción al canal de presencia (quién está conectado).
 * Sin las env vars configuradas queda en `null` y el chat/presencia se
 * desactivan sin romper el resto de la app (igual que Redis en cache.ts).
 */
const globalForPusher = globalThis as unknown as { pusherServer: Pusher | null | undefined }

function createClient(): Pusher | null {
  const { PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_CLUSTER } = process.env
  if (!PUSHER_APP_ID || !NEXT_PUBLIC_PUSHER_KEY || !PUSHER_SECRET || !NEXT_PUBLIC_PUSHER_CLUSTER) return null
  return new Pusher({
    appId: PUSHER_APP_ID,
    key: NEXT_PUBLIC_PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  })
}

export const pusherServer = globalForPusher.pusherServer ?? createClient()
if (process.env.NODE_ENV !== 'production') globalForPusher.pusherServer = pusherServer

export const CHAT_CHANNEL = 'presence-cabal-global'
export const CHAT_EVENT = 'chat-message'
