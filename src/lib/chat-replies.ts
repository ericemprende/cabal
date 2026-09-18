'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { jsonFetch } from '@/lib/api-client'
import { getPusherClient, CHAT_CHANNEL, CHAT_EVENT } from '@/lib/pusher-client'
import type { ChatMessageDTO } from '@/lib/types'

const SEEN_KEY = 'cabal:chat-replies-seen'

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

/**
 * Respuestas a mis mensajes del chat en vivo, para la campanita. Se refresca
 * al instante cuando llega por Pusher una respuesta dirigida a mí. "Visto" se
 * guarda en el navegador: si se pierde, solo vuelve a encenderse el punto.
 */
export function useChatReplies(myId: string | undefined) {
  const qc = useQueryClient()
  const queryKey = ['me', 'chat-replies', myId] as const
  const { data: replies = [] } = useQuery<ChatMessageDTO[]>({
    queryKey,
    queryFn: () => jsonFetch('/api/me/chat-replies'),
    enabled: !!myId,
    refetchInterval: 120_000,
  })

  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher || !myId) return
    const channel = pusher.channel(CHAT_CHANNEL) ?? pusher.subscribe(CHAT_CHANNEL)
    const onMessage = (msg: ChatMessageDTO) => {
      if (msg.replyTo?.user.id === myId && msg.user.id !== myId) {
        qc.invalidateQueries({ queryKey: ['me', 'chat-replies', myId] })
      }
    }
    channel.bind(CHAT_EVENT, onMessage)
    return () => {
      channel.unbind(CHAT_EVENT, onMessage)
    }
  }, [myId, qc])

  const [seenAt, setSeenAt] = useState(0)
  useEffect(() => setSeenAt(readSeen()), [])

  const unread = replies.filter((r) => new Date(r.createdAt).getTime() > seenAt).length

  const markSeen = useCallback(() => {
    const latest = replies[0] ? new Date(replies[0].createdAt).getTime() : 0
    if (latest <= seenAt) return
    setSeenAt(latest)
    try {
      localStorage.setItem(SEEN_KEY, String(latest))
    } catch {}
  }, [replies, seenAt])

  return { replies, unread, markSeen }
}
