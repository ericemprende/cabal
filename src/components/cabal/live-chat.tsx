'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Send, Users } from 'lucide-react'
import { UserAvatar } from '@/components/cabal/shared'
import { useChatMessages, useSendChatMessage, useSession } from '@/lib/api-client'
import { useOnlineIds, useIsOnline } from '@/lib/presence'
import { getPusherClient, CHAT_CHANNEL, CHAT_EVENT } from '@/lib/pusher-client'
import { useUI } from '@/lib/store'
import type { ChatMessageDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Chat en vivo global del Cabal. Historial vía React Query, mensajes nuevos
 * por Pusher (evento `chat-message` en el canal de presencia). El punto
 * verde de "conectado" viene de la misma suscripción (ver lib/presence.ts).
 */
export function LiveChat() {
  const { data: history } = useChatMessages()
  const [live, setLive] = useState<ChatMessageDTO[]>([])
  const onlineIds = useOnlineIds()
  const { data: session } = useSession()
  const send = useSendChatMessage()
  const { openAuth } = useUI()
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher) return
    const channel = pusher.channel(CHAT_CHANNEL) ?? pusher.subscribe(CHAT_CHANNEL)
    const onMessage = (msg: ChatMessageDTO) => setLive((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    channel.bind(CHAT_EVENT, onMessage)
    return () => {
      channel.unbind(CHAT_EVENT, onMessage)
    }
  }, [])

  const messages = [...(history ?? []), ...live].slice(-100)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length])

  const canChat = getPusherClient() !== null

  const handleSend = () => {
    const body = text.trim()
    if (!body) return
    send.mutate(body, {
      onSuccess: (msg) => setLive((prev) => [...prev, msg]),
    })
    setText('')
  }

  if (!canChat) return null

  return (
    <section className="card-surface flex h-[420px] flex-col rounded-xl border border-white/10">
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
        {messages.map((m) => (
          <ChatLine key={m.id} msg={m} />
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 p-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          onFocus={() => {
            if (!session?.loggedIn) openAuth('login')
          }}
          maxLength={500}
          placeholder="Escribe al Cabal…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0f110c] px-3 py-2 text-[13px] outline-none focus:border-[#8FA83F]/40"
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

function ChatLine({ msg }: { msg: ChatMessageDTO }) {
  const online = useIsOnline(msg.user.id)
  return (
    <div className="flex items-start gap-2">
      <UserAvatar name={msg.user.name} handle={msg.user.handle} src={msg.user.avatar} size="xs" online={online} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5">
          <Link href={`/u/${msg.user.handle}`} className="truncate text-[12px] font-bold hover:underline">
            {msg.user.name}
          </Link>
        </p>
        <p className={cn('break-words text-[13px] leading-snug text-foreground/90')}>{msg.body}</p>
      </div>
    </div>
  )
}
