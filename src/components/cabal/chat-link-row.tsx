'use client'

import { useState } from 'react'
import { ChevronDown, Megaphone, Search, Trash2, User, Users, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useDeleteChat, useMyReminders, useUpdateChat, useUpdateReminderLeads } from '@/lib/notify-client'

import { REMINDER_LEADS, leadLabel, toggleLead, type ChatLinkDTO } from '@/lib/notify-types'
import { MAX_TOKEN_FILTER, normalizeFilterEntry, toggleFilterEntry } from '@/lib/token-filter'

/**
 * Un chat vinculado (Telegram o Discord) con sus avisos e idioma. Es el mismo
 * componente para los dos: solo cambian el color de marca y cómo se llama cada
 * tipo de chat (un "grupo" de Telegram es un "canal" de servidor en Discord).
 */

const PREFS: { key: 'notifyLaunches' | 'notifyReminders' | 'notifyTheses' | 'notifyCalls' | 'onlyFollowing'; label: string }[] = [
  { key: 'notifyLaunches', label: 'Lanzamientos nuevos' },
  { key: 'notifyReminders', label: 'Aviso antes de cada launch' },
  { key: 'notifyCalls', label: 'Calls nuevas de Cabal' },
  { key: 'notifyTheses', label: 'Tesis nuevas' },
  { key: 'onlyFollowing', label: 'Solo de gente que sigo' },
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
  const [open, setOpen] = useState(false)
  const isPrivate = chat.chatType === 'private'
  const mine = useMyReminders()
  const updateMine = useUpdateReminderLeads()
  const updateChat = useUpdateChat()
  const value = isPrivate ? mine.data?.leads ?? chat.reminderLeads : chat.reminderLeads
  const busy = updateMine.isPending || updateChat.isPending || !chat.active

  const toggle = (m: number) => {
    const next = toggleLead(value, m)
    if (next === value) return // era el último: no se puede quedar sin ninguno
    if (isPrivate) updateMine.mutate(next)
    else updateChat.mutate({ id: chat.id, reminderLeads: next })
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-[12px]"
      >
        <span className="text-foreground/85">Avisar antes del lanzamiento</span>
        <span className="flex items-center gap-1 font-bold" style={{ color: text }}>
          {value.map(leadLabel).join(' · ')}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 rounded-lg border border-white/10 p-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Antelación del aviso">
            {REMINDER_LEADS.map((m) => {
              const active = value.includes(m)
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  disabled={busy}
                  onClick={() => toggle(m)}
                  style={active ? { backgroundColor: `${brand}33`, color: text } : undefined}
                  className={cn(
                    'rounded-md border border-white/10 px-2 py-0.5 text-[11px] font-bold transition-colors',
                    !active && 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {leadLabel(m)}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Puedes marcar varias y recibirás un aviso en cada una.
            {isPrivate && ' Vale también para tus avisos por correo.'}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Filtro por token: con tokens en la lista, al chat
 * solo le llegan las calls, tesis, lanzamientos y avisos de esos tokens.
 */
function TokenFilterPicker({ chat, text }: { chat: ChatLinkDTO; text: string }) {
  const update = useUpdateChat()
  const [open, setOpen] = useState(chat.tokenFilter.length > 0)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const busy = update.isPending || !chat.active
  const full = chat.tokenFilter.length >= MAX_TOKEN_FILTER

  const save = (next: string[]) => update.mutate({ id: chat.id, tokenFilter: next })
  const add = () => {
    const entry = normalizeFilterEntry(draft)
    if (!entry) return setError('Pega un contrato (CA) o escribe un $TICKER')
    if (chat.tokenFilter.some((f) => f.toLowerCase() === entry.toLowerCase())) return setDraft('')
    setError(null)
    setDraft('')
    save(toggleFilterEntry(chat.tokenFilter, entry))
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-[12px]"
      >
        <span className="text-foreground/85">Solo avisos de ciertos tokens</span>
        <span className="flex items-center gap-1 font-bold" style={{ color: text }}>
          {chat.tokenFilter.length ? `${chat.tokenFilter.length} token${chat.tokenFilter.length > 1 ? 's' : ''}` : 'Todos'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-lg border border-white/10 p-2">
          {chat.tokenFilter.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chat.tokenFilter.map((f) => (
                <span key={f} className="flex max-w-full items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[11px]">
                  <span className="truncate">{f.startsWith('$') ? f : `${f.slice(0, 6)}…${f.slice(-4)}`}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(chat.tokenFilter.filter((x) => x !== f))}
                    className="text-muted-foreground hover:text-[#ff8080]"
                    aria-label={`Quitar ${f} del filtro`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-white/10 px-1.5">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setError(null)
                }}
                disabled={busy || full}
                placeholder={full ? `Máximo ${MAX_TOKEN_FILTER} tokens` : 'Contrato o $TICKER'}
                aria-label="Añadir token al filtro"
                className="h-7 min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={busy || full || !draft.trim()}
              className="rounded-md border border-white/10 px-2 text-[11px] font-bold disabled:opacity-50"
              style={{ color: text }}
            >
              Añadir
            </button>
          </form>
          {error && <p className="text-[10px] text-[#ff8080]">{error}</p>}
          <p className="text-[10px] text-muted-foreground">
            {chat.tokenFilter.length
              ? 'A este chat solo le llegan calls, tesis, lanzamientos y avisos de estos tokens.'
              : 'Sin filtro: llegan avisos de todos los tokens. El contrato es lo más fiable; el $TICKER puede coincidir con otros tokens.'}
          </p>
        </div>
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
      <TokenFilterPicker chat={chat} text={text} />
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
