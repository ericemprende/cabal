'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CornerUpLeft, ExternalLink, HandHeart, Heart, Megaphone, Send, Users, X } from 'lucide-react'
import { UserAvatar } from '@/components/cabal/shared'
import { jsonFetch, useChatMessages, useSendChatMessage, useSession } from '@/lib/api-client'
import { useOnlineIds, useIsOnline } from '@/lib/presence'
import { getPusherClient, CHAT_CHANNEL, CHAT_EVENT, CHAT_LIKE_EVENT } from '@/lib/pusher-client'
import { markChatRead } from '@/lib/chat-unread'
import { useUI } from '@/lib/store'
import type { ChatMessageDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Chat en vivo global del Cabal. Historial vía React Query, mensajes nuevos
 * por Pusher (evento `chat-message` en el canal de presencia). El punto
 * verde de "conectado" viene de la misma suscripción (ver lib/presence.ts).
 */
export function LiveChat({ className, showUnavailable }: { className?: string; showUnavailable?: boolean } = {}) {
  const { data: history } = useChatMessages()
  const [live, setLive] = useState<ChatMessageDTO[]>([])
  const onlineIds = useOnlineIds()
  const { data: session } = useSession()
  const send = useSendChatMessage()
  const { openAuth } = useUI()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessageDTO | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // "Me gusta" más recientes que el historial (por Pusher o por mi propio clic)
  const [likes, setLikes] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher) return
    const channel = pusher.channel(CHAT_CHANNEL) ?? pusher.subscribe(CHAT_CHANNEL)
    const onMessage = (msg: ChatMessageDTO) => setLive((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    const onLike = (p: { id: string; likedBy: string[] }) => setLikes((prev) => ({ ...prev, [p.id]: p.likedBy }))
    channel.bind(CHAT_EVENT, onMessage)
    channel.bind(CHAT_LIKE_EVENT, onLike)
    return () => {
      channel.unbind(CHAT_EVENT, onMessage)
      channel.unbind(CHAT_LIKE_EVENT, onLike)
    }
  }, [])

  const messages = [...(history ?? []), ...live].slice(-100)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    // Mientras el chat está a la vista, lo que llega queda leído
    markChatRead()
  }, [messages.length])

  const me = session?.loggedIn ? session.user?.id ?? null : null

  const toggleLike = (msg: ChatMessageDTO) => {
    if (!me) return openAuth('login')
    const current = likes[msg.id] ?? msg.likedBy
    // Optimista: el corazón cambia al instante; el servidor manda la lista buena
    setLikes((prev) => ({
      ...prev,
      [msg.id]: current.includes(me) ? current.filter((id) => id !== me) : [...current, me],
    }))
    jsonFetch<{ id: string; likedBy: string[] }>(`/api/chat/messages/${msg.id}/like`, { method: 'POST' })
      .then((r) => setLikes((prev) => ({ ...prev, [r.id]: r.likedBy })))
      .catch(() => setLikes((prev) => ({ ...prev, [msg.id]: current })))
  }

  const canChat = getPusherClient() !== null

  const handleSend = () => {
    const body = text.trim()
    if (!body) return
    send.mutate({ body, replyToId: replyTo?.id ?? null }, {
      // El eco por Pusher puede llegar antes de que resuelva este POST: sin
      // este chequeo, el mensaje propio quedaba agregado dos veces.
      onSuccess: (msg) => setLive((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])),
    })
    setText('')
    setReplyTo(null)
  }

  const startReply = (msg: ChatMessageDTO) => {
    if (!session?.loggedIn) return openAuth('login')
    setReplyTo(msg)
    inputRef.current?.focus()
  }

  // Salta al mensaje citado y lo resalta un momento.
  const jumpTo = (id: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.classList.add('bg-white/5')
    setTimeout(() => el.classList.remove('bg-white/5'), 1200)
  }

  if (!canChat) {
    if (!showUnavailable) return null
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
        El chat en vivo no está disponible en este momento
      </p>
    )
  }

  return (
    <section className={cn('card-surface flex h-[420px] flex-col rounded-xl border border-white/10', className)}>
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Chat en vivo</p>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
          <Users className="h-3 w-3" aria-hidden /> {onlineIds.size}
        </span>
      </div>

      <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5">
        {messages.length === 0 && (
          <p className="pt-6 text-center text-xs text-muted-foreground">Sé el primero en escribir</p>
        )}
        {messages.map((m) =>
          m.system ? (
            <SystemLine key={m.id} msg={m} />
          ) : (
            <ChatLine
              key={m.id}
              msg={m}
              likedBy={likes[m.id] ?? m.likedBy}
              me={me}
              onLike={toggleLike}
              onReply={startReply}
              onJump={jumpTo}
            />
          )
        )}
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-1.5 text-[11px] text-muted-foreground">
          <CornerUpLeft className="h-3 w-3 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 truncate">
            Respondiendo a <span className="font-bold text-foreground">{replyTo.user.name}</span>: {replyTo.body}
          </p>
          <button onClick={() => setReplyTo(null)} className="shrink-0 hover:text-foreground" aria-label="Cancelar respuesta">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-white/10 p-2.5">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
            else if (e.key === 'Escape') setReplyTo(null)
          }}
          onFocus={() => {
            if (!session?.loggedIn) openAuth('login')
          }}
          maxLength={500}
          placeholder="Escribe al Cabal…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0f110c] px-3 py-2 text-base outline-none sm:text-[13px] focus:border-[#8FA83F]/40"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || send.isPending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          aria-label="Enviar mensaje"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  )
}

/**
 * Aviso automático de Cabal (ver lib/chat-announce.ts). Va como tarjeta, no
 * como mensaje de alguien: no se puede responder ni dar corazón, y es el
 * único sitio del chat donde hay algo pulsable. Con "donate" abre el diálogo
 * de donaciones sin sacar a nadie de la app.
 */
function SystemLine({ msg }: { msg: ChatMessageDTO }) {
  const setDonateOpen = useUI((s) => s.setDonateOpen)
  const href = msg.linkUrl ?? ''
  const label = msg.linkLabel || 'Abrir'
  const external = /^https?:/.test(href)
  const btn =
    'mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground transition-opacity hover:opacity-90'

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
        <Megaphone className="h-3.5 w-3.5 shrink-0" aria-hidden /> Cabal
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground/90">{msg.body}</p>
      {href === 'donate' && (
        <button onClick={() => setDonateOpen(true)} className={btn}>
          <HandHeart className="h-3.5 w-3.5" aria-hidden /> {label}
        </button>
      )}
      {href.startsWith('/') && (
        <Link href={href} className={btn}>
          {label}
        </Link>
      )}
      {external && (
        <a href={href} target="_blank" rel="noreferrer" className={btn}>
          {label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
    </div>
  )
}

function ChatLine({
  msg,
  likedBy,
  me,
  onLike,
  onReply,
  onJump,
}: {
  msg: ChatMessageDTO
  likedBy: string[]
  me: string | null
  onLike: (msg: ChatMessageDTO) => void
  onReply: (msg: ChatMessageDTO) => void
  onJump: (id: string) => void
}) {
  const online = useIsOnline(msg.user.id)
  const liked = !!me && likedBy.includes(me)
  return (
    <div data-msg-id={msg.id} className="group relative -mx-1 flex items-start gap-2 rounded-md px-1 transition-colors">
      <UserAvatar name={msg.user.name} handle={msg.user.handle} src={msg.user.avatar} size="xs" online={online} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5">
          <Link href={`/u/${msg.user.handle}`} className="truncate text-[12px] font-bold hover:underline">
            {msg.user.name}
          </Link>
        </p>
        {msg.replyTo && (
          <button
            onClick={() => onJump(msg.replyTo!.id)}
            className="mb-0.5 block w-full truncate border-l-2 border-[#8FA83F]/50 pl-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
          >
            <span className="font-bold">@{msg.replyTo.user.handle}</span> {msg.replyTo.body}
          </button>
        )}
        <p className={cn('break-words text-[13px] leading-snug text-foreground/90')}>{msg.body}</p>
      </div>
      {/* Corazón: con "me gusta" se queda visible; si no, aparece al pasar el mouse (siempre en táctil). */}
      <button
        onClick={() => onLike(msg)}
        className={cn(
          'flex shrink-0 items-center gap-0.5 rounded p-1 text-[11px] font-bold transition-colors',
          liked ? 'text-rose-400' : 'text-muted-foreground hover:text-rose-400',
          likedBy.length === 0 && 'sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100'
        )}
        aria-label={liked ? 'Quitar me gusta' : `Me gusta el mensaje de ${msg.user.name}`}
        aria-pressed={liked}
        title="Me gusta"
      >
        <Heart className={cn('h-3.5 w-3.5', liked && 'fill-rose-400')} aria-hidden />
        {likedBy.length > 0 && <span className="tabular-nums">{likedBy.length}</span>}
      </button>
      {/* Visible siempre en táctil; en escritorio aparece al pasar el mouse. */}
      <button
        onClick={() => onReply(msg)}
        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        aria-label={`Responder a ${msg.user.name}`}
        title="Responder"
      >
        <CornerUpLeft className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}
