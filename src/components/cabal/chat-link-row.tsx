'use client'

import { Megaphone, Trash2, User, Users } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useDeleteChat, useUpdateChat } from '@/lib/notify-client'
import type { ChatLinkDTO } from '@/lib/notify-types'

/**
 * Un chat vinculado (Telegram o Discord) con sus avisos e idioma. Es el mismo
 * componente para los dos: solo cambian el color de marca y cómo se llama cada
 * tipo de chat (un "grupo" de Telegram es un "canal" de servidor en Discord).
 */

const PREFS: { key: 'notifyLaunches' | 'notifyReminders' | 'notifyTheses'; label: string }[] = [
  { key: 'notifyLaunches', label: 'Lanzamientos nuevos' },
  { key: 'notifyReminders', label: '1 h antes de cada launch' },
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
