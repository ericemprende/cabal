'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { jsonFetch } from '@/lib/api-client'
import type {
  AdminChatsDTO,
  AdminNotifyDTO,
  BotProviderName,
  ChatLinkCodeDTO,
  ChatLinkDTO,
  MyChatsDTO,
  MyRemindersDTO,
  ReminderChannelsDTO,
} from '@/lib/notify-types'

// Hooks de la campanita de launches y de los chats de Telegram/Discord.

export const notifyKeys = {
  reminders: ['me', 'reminders'] as const,
  chats: ['me', 'chats'] as const,
  admin: ['admin', 'notifications'] as const,
  adminChats: (provider: BotProviderName) => ['admin', 'notifications', 'chats', provider] as const,
}

export function useMyReminders() {
  return useQuery<MyRemindersDTO>({
    queryKey: notifyKeys.reminders,
    queryFn: () => jsonFetch('/api/me/reminders'),
    staleTime: 30_000,
  })
}

export class LoginRequiredError extends Error {}

export function useToggleReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (launchId: string) => {
      const res = await fetch(`/api/launches/${launchId}/remind`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.status === 401) throw new LoginRequiredError(body.error ?? 'Inicia sesión')
      if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`)
      return body as { reminded: boolean; channels: ReminderChannelsDTO }
    },
    // Respuesta inmediata en la campanita, sin esperar al servidor
    onMutate: async (launchId) => {
      await qc.cancelQueries({ queryKey: notifyKeys.reminders })
      const prev = qc.getQueryData<MyRemindersDTO>(notifyKeys.reminders)
      if (prev) {
        const on = prev.launchIds.includes(launchId)
        qc.setQueryData<MyRemindersDTO>(notifyKeys.reminders, {
          ...prev,
          launchIds: on ? prev.launchIds.filter((id) => id !== launchId) : [...prev.launchIds, launchId],
        })
      }
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(notifyKeys.reminders, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notifyKeys.reminders }),
  })
}

export function useMyChats(enabled = true) {
  return useQuery<MyChatsDTO>({ queryKey: notifyKeys.chats, queryFn: () => jsonFetch('/api/me/chats'), enabled })
}

/** Código para vincular un chat. El DTO que vuelve depende del proveedor. */
export function useCreateChatLinkCode<P extends BotProviderName>(provider: P) {
  return useMutation({
    mutationFn: () =>
      jsonFetch<Extract<ChatLinkCodeDTO, { provider: P }>>('/api/me/chats/link', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      }),
    onError: (e: Error) => toast.error(e.message),
  })
}

/** Antelaciones del aviso de la campanita (del usuario, no de un chat). */
export function useUpdateReminderLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (leads: number[]) =>
      jsonFetch<{ leads: number[] }>('/api/me/reminders', {
        method: 'PATCH',
        body: JSON.stringify({ leads }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notifyKeys.reminders }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...prefs
    }: { id: string } & Partial<
      Pick<ChatLinkDTO, 'notifyLaunches' | 'notifyReminders' | 'notifyTheses' | 'notifyCalls' | 'notifyBoosts' | 'lang' | 'reminderLeads' | 'tokenFilter' | 'onlyFollowing' | 'inviteUrl'>
    >) =>
      jsonFetch<ChatLinkDTO>(`/api/me/chats/${id}`, { method: 'PATCH', body: JSON.stringify(prefs) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notifyKeys.chats }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`/api/me/chats/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifyKeys.chats })
      qc.invalidateQueries({ queryKey: notifyKeys.reminders })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ---------- Admin ----------

export function useAdminNotify(enabled = true) {
  return useQuery<AdminNotifyDTO>({
    queryKey: notifyKeys.admin,
    queryFn: () => jsonFetch('/api/admin/notifications'),
    enabled,
  })
}

export function useAdminNotifyUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { provider: BotProviderName; token?: string; enabled?: boolean; disconnect?: boolean }) =>
      jsonFetch<{ ok: boolean; username?: string }>('/api/admin/notifications', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notifyKeys.admin }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminNotifyAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { action: 'refresh' | 'test' | 'run'; provider?: BotProviderName; chatId?: string }) =>
      jsonFetch<{ ok: boolean; sent?: number; result?: Record<string, number> }>('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notifyKeys.admin }),
    onError: (e: Error) => toast.error(e.message),
  })
}

/**
 * Chats de un bot con sus miembros. `fresh` salta la caché del servidor (1 h)
 * y vuelve a preguntar a Telegram/Discord.
 */
export function useAdminBotChats(provider: BotProviderName, enabled = true) {
  const qc = useQueryClient()
  const query = useQuery<AdminChatsDTO>({
    queryKey: notifyKeys.adminChats(provider),
    queryFn: () => jsonFetch(`/api/admin/notifications/chats?provider=${provider}`),
    enabled,
    staleTime: 5 * 60_000,
  })
  const refresh = useMutation({
    mutationFn: () => jsonFetch<AdminChatsDTO>(`/api/admin/notifications/chats?provider=${provider}&fresh=1`),
    onSuccess: (data) => qc.setQueryData(notifyKeys.adminChats(provider), data),
    onError: (e: Error) => toast.error(e.message),
  })
  return { ...query, refresh }
}
