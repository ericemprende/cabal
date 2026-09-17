'use client'

import { Megaphone, Trash2, User, Users } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useDeleteChat, useMyReminders, useUpdateChat, useUpdateReminderLead } from '@/lib/notify-client'
import { REMINDER_LEADS, leadLabel, type ChatLinkDTO } from '@/lib/notify-types'

/**
 * Un chat vinculado (Telegram o Discord) con sus avisos e idioma. Es el mismo
 * componente para los dos: solo cambian el color de marca y cómo se llama cada
 * tipo de chat (un "grupo" de Telegram es un "canal" de servidor en Discord).
 */

const PREFS: { key: 'notifyLaunches' | 'notifyReminders' | 'notifyTheses'; label: string }[] = [
  { key: 'notifyLaunches', label: 'Lanzamientos nuevos' },
  { key: 'notifyReminders', label: 'Aviso antes de cada launch' },
  { key: 'notifyTheses', label: 'Tesis nuevas' },
]

export const BRAND = { telegram: '#229ED9', discord: '#5865F2' } as const
/** Tono claro del color de marca, para texto sobre fondo oscuro. */
const BRAND_TEXT = { telegram: '#5cc0f0', discord: '#98a2fa' } as const

function typeLabel(chat: ChatLinkDTO): string {
  if (chat.chatType === 'private') return 'privado'
  if (chat.provider === 'discord') return chat.chatType === 'channel' ? 'anuncios' : 'canal'
  return chat.chatType === 'channel' ? 'canal' : 'grupo'
}

/**
 * Con cuánta antelación llega el aviso de un lanzamiento.
 *
 * En un privado la decide el usuario y vale para todos sus avisos (chats y
 * correo), así que se guarda en su cuenta; en un grupo la decide el grupo y se
 * guarda en el chat. Es el mismo control en los dos casos para que nadie tenga
 * que saber esa diferencia.
 */
function LeadPicker({ chat, brand, text }: { chat: ChatLinkDTO; brand: string; text: string }) {
  const isPrivate = chat.chatType === 'private'
  const mine = useMyReminders()
  const updateMine = useUpdateReminderLead()
  const updateChat = useUpdateChat()
  const value = isPrivate ? mine.data?.leadMinutes ?? chat.reminderLeadMin : chat.reminderLeadMin
  const busy = updateMine.isPending || updateChat.isPending || !chat.active

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="text-foreground/85">Avisar antes del lanzamiento</span>
        <div className="flex flex-wrap justify-end gap-1" role="group" aria-label="Antelación del aviso">
          {REMINDER_LEADS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={value === m}
              disabled={busy}
              onClick={() => {
                if (value === m) return
                if (isPrivate) updateMine.mutate(m)
                else updateChat.mutate({ id: chat.id, reminderLeadMin: m })
              }}
              style={value === m ? { backgroundColor: `${brand}33`, color: text } : undefined}
              className={cn(
                'rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] font-bold transition-colors',
                value !== m && 'text-muted-foreground hover:text-foreground'
              )}
            >
              {leadLabel(m)}
            </button>
          ))}
        </div>
      </div>
      {isPrivate && (
        <p className="text-[10px] text-muted-foreground">Vale también para los avisos por correo.</p>
      )}
    </div>
  )
}

export function ChatLinkRow({ chat }: { chat: ChatLinkDTO }) {
  const update = useUpdateChat()
  const remove = useDeleteChat()
  const isPrivate = chat.chatType === 'private'
  const Icon = isPrivate ? User : chat.chatType === 'channel' ? Megaphone : Users
  const text = BRAND_TEXT[chat.provider]
  const brand = BRAND[chat.provider]
  const self = chat.provider === 'discord' ? 'Mi Discord' : 'Mi Telegram'

  return (
    <div className={cn('rounded-xl border border-white/10 bg-[#0a0b08] p-3', !chat.active && 'opacity-60')}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color: text }} aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {isPrivate ? self : chat.title ?? 'Chat sin nombre'}
          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{typeLabel(chat)}</span>
        </p>
        <button
          type="button"
          onClick={() => remove.mutate(chat.id)}
          disabled={remove.isPending}
          className="rounded-md p-1 text-muted-foreground hover:text-[#ff8080]"
          aria-label="Desvincular chat"
          title="Desvincular"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {!chat.active && (
        <p className="mt-1 text-[11px] text-amber-300">
          El bot ya no puede escribir aquí{chat.lastError ? ` (${chat.lastError})` : ''}. Vuelve a añadirlo para
          reactivarlo.
        </p>
      )}
      {isPrivate && <p className="mt-1 text-[11px] text-muted-foreground">Aquí llegan siempre los avisos de tu campanita.</p>}
      <div className="mt-2 flex items-center justify-between gap-2 text-[12px]">
        <span className="text-foreground/85">Idioma del bot</span>
        <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Idioma del bot">
          {(['es', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={chat.lang === l}
              disabled={update.isPending || !chat.active}
              onClick={() => chat.lang !== l && update.mutate({ id: chat.id, lang: l })}
              style={chat.lang === l ? { backgroundColor: `${brand}33`, color: text } : undefined}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-bold transition-colors',
                chat.lang !== l && 'text-muted-foreground hover:text-foreground'
              )}
            >
              {l === 'es' ? 'Español' : 'English'}
            </button>
          ))}
        </div>
      </div>
      <LeadPicker chat={chat} brand={brand} text={text} />
      <div className="mt-2 space-y-1.5">
        {PREFS.map((p) => (
          <label key={p.key} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="text-foreground/85">{p.label}</span>
            <Switch
              checked={chat[p.key]}
              disabled={update.isPending || !chat.active}
              onCheckedChange={(v) => update.mutate({ id: chat.id, [p.key]: v })}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
