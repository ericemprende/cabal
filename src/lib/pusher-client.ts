'use client'

import PusherClient from 'pusher-js'

/**
 * Cliente de Pusher del navegador, compartido por toda la app (un solo socket).
 * `null` si no hay NEXT_PUBLIC_PUSHER_KEY configurada: el chat/presencia se
 * ocultan en vez de romper la app (ver usePresence / live-chat.tsx).
 */
let client: PusherClient | null | undefined

export function getPusherClient(): PusherClient | null {
  if (client !== undefined) return client
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  if (!key || !cluster) {
    client = null
    return client
  }
  client = new PusherClient(key, {
    cluster,
    authEndpoint: '/api/pusher/auth',
  })
  return client
}

export const CHAT_CHANNEL = 'presence-cabal-global'
export const CHAT_EVENT = 'chat-message'
/** Cambió la lista de "me gusta" de un mensaje: { id, likedBy }. */
export const CHAT_LIKE_EVENT = 'chat-like'
