'use client'

import { useState } from 'react'
import { ChevronDown, Link as LinkIcon, Megaphone, Search, Trash2, User, Users, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useDeleteChat, useMyReminders, useUpdateChat, useUpdateReminderLeads } from '@/lib/notify-client'

import { REMINDER_LEADS, leadLabel, toggleLead, type ChatLinkDTO } from '@/lib/notify-types'
import { MAX_TOKEN_FILTER, normalizeFilterEntry, toggleFilterEntry } from '@/lib/token-filter'
import { useT } from '@/lib/i18n/provider'

/**
 * Un chat vinculado (Telegram o Discord) con sus avisos e idioma. Es el mismo
 * componente para los dos: solo cambian el color de marca y cómo se llama cada
 * tipo de chat (un "grupo" de Telegram es un "canal" de servidor en Discord).
 */

const PREFS: { key: 'notifyLaunches' | 'notifyReminders' | 'notifyTheses' | 'notifyCalls' | 'notifyBoosts' | 'notifyMilestones' | 'fixLinks' | 'onlyFollowing' }[] = [
  { key: 'notifyLaunches' },
  { key: 'notifyReminders' },
  { key: 'notifyCalls' },
  { key: 'notifyTheses' },
  { key: 'notifyBoosts' },
  { key: 'notifyMilestones' },
  { key: 'fixLinks' },
  { key: 'onlyFollowing' },
]

export const BRAND = { telegram: '#229ED9', discord: '#5865F2' } as const
/** Tono claro del color de marca, para texto sobre fondo oscuro. */
const BRAND_TEXT = { telegram: '#5cc0f0', discord: '#98a2fa' } as const

function typeKey(chat: ChatLinkDTO): 'private' | 'announcements' | 'channel' | 'group' {
  if (chat.chatType === 'private') return 'private'
  if (chat.provider === 'discord') return chat.chatType === 'channel' ? 'announcements' : 'channel'
  return chat.chatType === 'channel' ? 'channel' : 'group'
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
  const t = useT()
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
        <span className="text-foreground/85">{t.chatLink.leadTitle}</span>
        <span className="flex items-center gap-1 font-bold" style={{ color: text }}>
          {value.map(leadLabel).join(' · ')}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 rounded-lg border border-white/10 p-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label={t.chatLink.leadAria}>
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
  const t = useT()
  const update = useUpdateChat()
  const [open, setOpen] = useState(chat.tokenFilter.length > 0)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const busy = update.isPending || !chat.active
  const full = chat.tokenFilter.length >= MAX_TOKEN_FILTER

  const save = (next: string[]) => update.mutate({ id: chat.id, tokenFilter: next })
  const add = () => {
    const entry = normalizeFilterEntry(draft)
    if (!entry) return setError(t.chatLink.filterError)
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
        <span className="text-foreground/85">{t.chatLink.filterTitle}</span>
        <span className="flex items-center gap-1 font-bold" style={{ color: text }}>
          {chat.tokenFilter.length ? t.chatLink.filterCount(chat.tokenFilter.length) : t.chatLink.filterAll}
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
                    aria-label={t.chatLink.removeFilter(f)}
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
                placeholder={full ? t.chatLink.filterFull(MAX_TOKEN_FILTER) : t.chatLink.filterPlaceholder}
                aria-label={t.chatLink.filterAdd}
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
              ? t.chatLink.filterOn
              : t.chatLink.filterOff}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Enlace con el que cualquiera puede unirse a este clan desde el ranking de
 * Clanes.
 *
 * Normalmente no hay que tocar nada: en Telegram el bot saca el enlace del
 * grupo, y en Discord se crea una invitación permanente él mismo. Este campo
 * es para cuando no puede: un servidor que añadió el bot antes de que pidiera
 * permiso para invitar, o un grupo privado sin enlace público.
 */
function InvitePicker({ chat, text }: { chat: ChatLinkDTO; text: string }) {
  const t = useT()
  const update = useUpdateChat()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(chat.inviteUrl ?? '')
  const busy = update.isPending || !chat.active
  const example = chat.provider === 'discord' ? 'https://discord.gg/tuservidor' : 'https://t.me/tugrupo'
  const changed = draft.trim() !== (chat.inviteUrl ?? '')

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-[12px]"
      >
        <span className="text-foreground/85">{t.chatLink.inviteTitle}</span>
        <span className="flex items-center gap-1 font-bold" style={{ color: text }}>
          {chat.inviteUrl ? t.chatLink.inviteMine : t.chatLink.inviteAuto}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-lg border border-white/10 p-2">
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (changed) update.mutate({ id: chat.id, inviteUrl: draft.trim() })
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-white/10 px-1.5">
              <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
                placeholder={example}
                aria-label={t.chatLink.inviteAria}
                className="h-7 min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !changed}
              className="rounded-md border border-white/10 px-2 text-[11px] font-bold disabled:opacity-50"
              style={{ color: text }}
            >
              {draft.trim() ? t.chatLink.save : t.chatLink.remove}
            </button>
          </form>
          <p className="text-[10px] text-muted-foreground">
            {chat.inviteUrl
              ? t.chatLink.inviteOwn
              : chat.provider === 'discord'
                ? t.chatLink.inviteDiscord
                : t.chatLink.inviteTelegram}
          </p>
        </div>
      )}
    </div>
  )
}

export function ChatLinkRow({ chat }: { chat: ChatLinkDTO }) {
  const t = useT()
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
          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{t.chatLink.types[typeKey(chat)]}</span>
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
      {/* Un privado no es un clan: no hay a dónde unirse */}
      {!isPrivate && <InvitePicker chat={chat} text={text} />}
      <div className="mt-2 space-y-1.5">
        {PREFS.map((p) => (
          <label key={p.key} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="text-foreground/85">{t.chatLink.kinds[p.key]}</span>
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
