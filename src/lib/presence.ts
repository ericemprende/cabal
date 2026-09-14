'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { getPusherClient, CHAT_CHANNEL } from '@/lib/pusher-client'

interface PresenceMember {
  id: string
  info: { name?: string; handle?: string; avatar?: string }
}

interface PresenceState {
  onlineIds: Set<string>
  setOnlineIds: (ids: Set<string>) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineIds: new Set(),
  setOnlineIds: (onlineIds) => set({ onlineIds }),
}))

/**
 * Se conecta UNA vez al canal de presencia global de Pusher y mantiene el
 * set de usuarios conectados en el store. Móntalo una sola vez cerca de la
 * raíz de la app (layout / page principal); el resto de componentes solo
 * leen `useOnlineIds()` / `useIsOnline(id)`, no vuelven a suscribirse.
 */
export function usePresenceConnection() {
  const setOnlineIds = usePresenceStore((s) => s.setOnlineIds)

  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher) return

    const channel = pusher.subscribe(CHAT_CHANNEL) as import('pusher-js').PresenceChannel

    const sync = () => {
      const ids = new Set<string>()
      channel.members?.each?.((m: PresenceMember) => ids.add(m.id))
      setOnlineIds(ids)
    }

    channel.bind('pusher:subscription_succeeded', sync)
    channel.bind('pusher:member_added', sync)
    channel.bind('pusher:member_removed', sync)

    return () => {
      channel.unbind('pusher:subscription_succeeded', sync)
      channel.unbind('pusher:member_added', sync)
      channel.unbind('pusher:member_removed', sync)
      pusher.unsubscribe(CHAT_CHANNEL)
      setOnlineIds(new Set())
    }
  }, [setOnlineIds])
}

export function useOnlineIds(): Set<string> {
  return usePresenceStore((s) => s.onlineIds)
}

export function useIsOnline(userId: string | null | undefined): boolean {
  return usePresenceStore((s) => (userId ? s.onlineIds.has(userId) : false))
}
