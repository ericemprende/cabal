'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { getPusherClient, CHAT_CHANNEL } from '@/lib/pusher-client'

export interface OnlineMember {
  id: string
  name: string
  handle: string
  avatar: string
}

interface PresenceMember {
  id: string
  info: { name?: string; handle?: string; avatar?: string }
}

interface PresenceState {
  online: Map<string, OnlineMember>
  setOnline: (members: Map<string, OnlineMember>) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  online: new Map(),
  setOnline: (online) => set({ online }),
}))

/**
 * Se conecta UNA vez al canal de presencia global de Pusher y mantiene el
 * mapa de usuarios conectados en el store. Móntalo una sola vez cerca de la
 * raíz de la app (layout / page principal); el resto de componentes solo
 * leen useOnlineIds() / useIsOnline(id) / useOnlineMembers(), no vuelven a
 * suscribirse.
 */
export function usePresenceConnection() {
  const setOnline = usePresenceStore((s) => s.setOnline)

  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher) return

    const channel = pusher.subscribe(CHAT_CHANNEL) as import('pusher-js').PresenceChannel

    const sync = () => {
      const members = new Map<string, OnlineMember>()
      channel.members?.each?.((m: PresenceMember) =>
        members.set(m.id, {
          id: m.id,
          name: m.info.name ?? 'Alguien',
          handle: m.info.handle ?? '',
          avatar: m.info.avatar ?? '🐺',
        })
      )
      setOnline(members)
    }

    channel.bind('pusher:subscription_succeeded', sync)
    channel.bind('pusher:member_added', sync)
    channel.bind('pusher:member_removed', sync)

    return () => {
      channel.unbind('pusher:subscription_succeeded', sync)
      channel.unbind('pusher:member_added', sync)
      channel.unbind('pusher:member_removed', sync)
      pusher.unsubscribe(CHAT_CHANNEL)
      setOnline(new Map())
    }
  }, [setOnline])
}

export function useOnlineMembers(): OnlineMember[] {
  return usePresenceStore((s) => Array.from(s.online.values()))
}

export function useOnlineIds(): Set<string> {
  return usePresenceStore((s) => new Set(s.online.keys()))
}

export function useOnlineCount(): number {
  return usePresenceStore((s) => s.online.size)
}

export function useIsOnline(userId: string | null | undefined): boolean {
  return usePresenceStore((s) => (userId ? s.online.has(userId) : false))
}
