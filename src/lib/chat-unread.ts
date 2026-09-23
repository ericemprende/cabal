'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useChatMessages, useSession } from '@/lib/api-client'
import { getPusherClient, CHAT_CHANNEL, CHAT_EVENT } from '@/lib/pusher-client'
import { DEFAULT_CHAT_ROOM, type ChatRoom } from '@/lib/chat-rooms'
import { readChatRoom } from '@/lib/use-chat-room'
import type { ChatMessageDTO } from '@/lib/types'

/**
 * Mensajes del chat en vivo sin leer, para el contador de "Chat en vivo" en
 * Actividad del Cabal. "Leído" = llegó antes de la última vez que el chat
 * estuvo a la vista (LiveChat llama a markChatRead mientras se ve). La marca
 * se guarda en el navegador; la primera visita empieza en cero.
 */

/** Una marca de leído por sala: el chat en inglés no apaga el de español. */
const KEY = (room: ChatRoom) => `cabal:chat-read-at:${room}`

type Arrival = { id: string; at: number; userId: string; room: string }
const readAt: Partial<Record<ChatRoom, number>> = {}
let arrivals: Arrival[] = []
let version = 0
const listeners = new Set<() => void>()

function emit() {
  version++
  listeners.forEach((l) => l())
}

function loadReadAt(room: ChatRoom): number {
  const cached = readAt[room]
  if (cached !== undefined) return cached
  let stored: number | null = null
  try {
    const v = Number(localStorage.getItem(KEY(room)))
    if (Number.isFinite(v) && v > 0) stored = v
  } catch {}
  readAt[room] = stored ?? Date.now()
  if (stored === null) saveReadAt(room, readAt[room]!)
  return readAt[room]!
}

function saveReadAt(room: ChatRoom, v: number) {
  try {
    localStorage.setItem(KEY(room), String(v))
  } catch {}
}

/** La sala está a la vista: lo que haya llegado a ELLA queda leído. */
export function markChatRead(room: ChatRoom = DEFAULT_CHAT_ROOM) {
  const now = Date.now()
  const last = readAt[room]
  const pending = arrivals.some((a) => a.room === room)
  if (last !== undefined && now - last < 1000 && !pending) return
  readAt[room] = now
  arrivals = arrivals.filter((a) => a.room !== room)
  saveReadAt(room, now)
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
    arrivals = [...arrivals, { id: msg.id, at: new Date(msg.createdAt).getTime(), userId: msg.user.id, room: msg.room }].slice(-200)
    emit()
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

const noop = () => () => {}

/**
 * Sin sala, cuenta la del chat que esta persona mira (la que eligió con la
 * banderita): es la que va a abrir cuando pulse el contador.
 */
export function useChatUnread(room?: ChatRoom): number {
  const [pref, setPref] = useState<ChatRoom>(DEFAULT_CHAT_ROOM)
  useEffect(() => setPref(readChatRoom()), [])
  const active = room ?? pref
  const { data: history } = useChatMessages(active)
  const { data: session } = useSession()
  useSyncExternalStore(subscribe, () => version, () => 0)
  // Hasta montar se devuelve 0, igual que en el servidor (sin desajuste de hidratación)
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  useEffect(bindPusher, [])
  if (!mounted) return 0
  const since = loadReadAt(active)
  const me = session?.user?.id
  const ids = new Set<string>()
  for (const m of history ?? []) {
    if (m.user.id !== me && new Date(m.createdAt).getTime() > since) ids.add(m.id)
  }
  for (const a of arrivals) if (a.room === active && a.userId !== me && a.at > since) ids.add(a.id)
  return ids.size
}
