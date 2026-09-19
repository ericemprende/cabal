'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useChatMessages, useSession } from '@/lib/api-client'
import { getPusherClient, CHAT_CHANNEL, CHAT_EVENT } from '@/lib/pusher-client'
import type { ChatMessageDTO } from '@/lib/types'

/**
 * Mensajes del chat en vivo sin leer, para el contador de "Chat en vivo" en
 * Actividad del Cabal. "Leído" = llegó antes de la última vez que el chat
 * estuvo a la vista (LiveChat llama a markChatRead mientras se ve). La marca
 * se guarda en el navegador; la primera visita empieza en cero.
 */

const KEY = 'cabal:chat-read-at'

type Arrival = { id: string; at: number; userId: string }
let readAt: number | null = null
let arrivals: Arrival[] = []
let version = 0
const listeners = new Set<() => void>()

function emit() {
  version++
  listeners.forEach((l) => l())
}

function loadReadAt(): number {
  if (readAt !== null) return readAt
  let stored: number | null = null
  try {
    const v = Number(localStorage.getItem(KEY))
    if (Number.isFinite(v) && v > 0) stored = v
  } catch {}
  readAt = stored ?? Date.now()
  if (stored === null) saveReadAt(readAt)
  return readAt
}

function saveReadAt(v: number) {
  try {
    localStorage.setItem(KEY, String(v))
  } catch {}
}

/** El chat está a la vista: todo lo que haya llegado hasta ahora queda leído. */
export function markChatRead() {
  const now = Date.now()
  if (readAt !== null && now - readAt < 1000 && arrivals.length === 0) return
  readAt = now
  arrivals = []
  saveReadAt(now)
  emit()
}

let bound = false
function bindPusher() {
  if (bound) return
  const pusher = getPusherClient()
  if (!pusher) return
  bound = true
  const channel = pusher.channel(CHAT_CHANNEL) ?? pusher.subscribe(CHAT_CHANNEL)
  channel.bind(CHAT_EVENT, (msg: ChatMessageDTO) => {
    if (arrivals.some((a) => a.id === msg.id)) return
    arrivals = [...arrivals, { id: msg.id, at: new Date(msg.createdAt).getTime(), userId: msg.user.id }].slice(-200)
    emit()
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

const noop = () => () => {}

export function useChatUnread(): number {
  const { data: history } = useChatMessages()
  const { data: session } = useSession()
  useSyncExternalStore(subscribe, () => version, () => 0)
  // Hasta montar se devuelve 0, igual que en el servidor (sin desajuste de hidratación)
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  useEffect(bindPusher, [])
  if (!mounted) return 0
  const since = loadReadAt()
  const me = session?.user?.id
  const ids = new Set<string>()
  for (const m of history ?? []) {
    if (m.user.id !== me && new Date(m.createdAt).getTime() > since) ids.add(m.id)
  }
  for (const a of arrivals) if (a.userId !== me && a.at > since) ids.add(a.id)
  return ids.size
}
