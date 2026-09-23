'use client'

import { useState } from 'react'
import { Copy, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ChatLinkRow } from '@/components/cabal/chat-link-row'
import { DiscordLogo } from '@/components/cabal/discord-logo'
import { useCreateChatLinkCode, useMyChats } from '@/lib/notify-client'
import type { DiscordLinkCodeDTO } from '@/lib/notify-types'
import { useT } from '@/lib/i18n/provider'

/**
 * Sección del perfil: conectar el Discord propio (para la campanita) y añadir
 * el bot a un servidor.
 *
 * A diferencia de Telegram, Discord no tiene enlaces que lleven el código
 * dentro: se escribe a mano con /link CÓDIGO, tanto en el privado con el bot
 * como en el canal del servidor. Por eso siempre se enseña el código.
 */
export function DiscordConnect() {
  const chats = useMyChats()
  const createCode = useCreateChatLinkCode('discord')
  const [code, setCode] = useState<DiscordLinkCodeDTO | null>(null)
  const [mode, setMode] = useState<'private' | 'server'>('private')

  if (!chats.data?.discord.configured) return null
  const list = chats.data.chats.filter((c) => c.provider === 'discord')
  const hasPrivate = list.some((c) => c.chatType === 'private' && c.active)

  const newCode = (next: 'private' | 'server') => {
    setMode(next)
    createCode.mutate(undefined, { onSuccess: setCode })
  }

  return (
    <div className="space-y-2 border-b border-white/10 p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <DiscordLogo className="h-3.5 w-3.5" aria-hidden /> Discord
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Los mismos avisos que en Telegram, en tu Discord: la 🔔 campanita por privado y, si quieres, todos los
        lanzamientos y tesis en un canal de tu servidor.
      </p>
      <p className="text-[11px] text-muted-foreground">
        ¿Primera vez? <a href="/bot" target="_blank" rel="noreferrer" className="font-semibold text-[#98a2fa] hover:underline">
          Lee el manual del bot
        </a>
        : cómo conectarlo, qué hace cada comando y cómo filtrar los avisos.
      </p>

      <div className="flex flex-wrap gap-2">
        {!hasPrivate && (
          <Button
            size="sm"
            disabled={createCode.isPending}
            onClick={() => newCode('private')}
            className="gap-1.5 bg-[#5865F2] px-3 text-xs font-bold text-white hover:bg-[#4752c4]"
          >
            {createCode.isPending && mode === 'private' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <DiscordLogo className="h-3.5 w-3.5" />
            )}
            Conectar mi Discord
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={createCode.isPending}
          onClick={() => newCode('server')}
          className="gap-1.5 border-white/10 px-3 text-xs font-semibold"
        >
          <Users className="h-3.5 w-3.5" /> Añadir a un servidor
        </Button>
      </div>

      {code && <Instructions code={code} mode={mode} />}

      {list.length > 0 && (
        <div className="space-y-2 pt-1">
          {list.map((c) => (
            <ChatLinkRow key={c.id} chat={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function Instructions({ code, mode }: { code: DiscordLinkCodeDTO; mode: 'private' | 'server' }) {
  const t = useT()
  const command = `/link ${code.code}`
  const expires = new Date(code.expiresAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="space-y-2 rounded-xl border border-[#5865F2]/25 bg-[#5865F2]/5 p-3 text-[12px] leading-relaxed">
      {mode === 'private' ? (
        <>
          <p className="font-semibold">{t.connect.dcPrivate}</p>
          <p className="text-muted-foreground">
            {t.connect.dcPrivateBody1}
            <span className="font-semibold text-[#98a2fa]">{code.botUsername ?? t.connect.dcBot}</span>
            {t.connect.dcPrivateBody2}
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold">{t.connect.dcServer}</p>
          <p className="text-muted-foreground">
            <a href={code.invite} target="_blank" rel="noreferrer" className="font-semibold text-[#98a2fa] hover:underline">
              {t.connect.dcServerAdd}
            </a>
            {t.connect.dcServerBody}
          </p>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(command).then(() => toast.success(t.connect.copied))
        }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2 font-mono text-[13px] font-bold text-primary"
      >
        {command}
        <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </button>
      <p className="text-[10px] text-muted-foreground">El código sirve una vez y caduca a las {expires}.</p>
    </div>
  )
}
