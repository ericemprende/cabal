'use client'

import { useCallback, useEffect, useState } from 'react'
import { CHAT_ROOMS, DEFAULT_CHAT_ROOM, isChatRoom, type ChatRoom } from '@/lib/chat-rooms'

const KEY = 'cabal:chat-room'

/**
 * Sala del chat en la que está esta persona. Se recuerda en el navegador; la
 * primera vez se elige por el idioma de la plataforma, que para eso está.
 */
export function readChatRoom(fallback?: ChatRoom): ChatRoom {
  if (typeof window === 'undefined') return fallback ?? DEFAULT_CHAT_ROOM
  try {
    const saved = localStorage.getItem(KEY)
    if (isChatRoom(saved)) return saved
  } catch {}
  if (fallback) return fallback
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function useChatRoom(preferred?: ChatRoom): [ChatRoom, (r: ChatRoom) => void] {
  // Arranca igual que en el servidor y se ajusta al montar: si no, la primera
  // pintada y la hidratación no coinciden.
  const [room, setRoom] = useState<ChatRoom>(DEFAULT_CHAT_ROOM)
  useEffect(() => setRoom(readChatRoom(preferred)), [preferred])

  const choose = useCallback((r: ChatRoom) => {
    if (!CHAT_ROOMS.includes(r)) return
    setRoom(r)
    try {
      localStorage.setItem(KEY, r)
    } catch {}
  }, [])

  return [room, choose]
}
