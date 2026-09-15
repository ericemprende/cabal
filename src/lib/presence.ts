'use client'

import { useEffect, useMemo } from 'react'
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

/**
 * Los selectores de zustand deben devolver una referencia estable si el
 * estado no cambió; devolver un Set/Array nuevo en cada llamada (como se
 * hacía antes) hace que React crea que el snapshot cambia sin parar y
 * revienta con "Maximum update depth exceeded" apenas se monta el
 * componente. Por eso acá se lee el Map (referencia estable) y la
 * conversión a array/set se memoiza aparte, solo cuando el Map cambia.
 */
export function useOnlineMembers(): OnlineMember[] {
  const online = usePresenceStore((s) => s.online)
  return useMemo(() => Array.from(online.values()), [online])
}

export function useOnlineIds(): Set<string> {
  const online = usePresenceStore((s) => s.online)
  return useMemo(() => new Set(online.keys()), [online])
}

export function useOnlineCount(): number {
  return usePresenceStore((s) => s.online.size)
}

export function useIsOnline(userId: string | null | undefined): boolean {
  return usePresenceStore((s) => (userId ? s.online.has(userId) : false))
}
