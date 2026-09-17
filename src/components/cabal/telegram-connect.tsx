'use client'

import { useState } from 'react'
import { Copy, Loader2, Send, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ChatLinkRow } from '@/components/cabal/chat-link-row'
import { useCreateChatLinkCode, useMyChats } from '@/lib/notify-client'
import type { TelegramLinkCodeDTO } from '@/lib/notify-types'

/**
 * Sección del perfil: conectar el Telegram propio (para la campanita) y
 * añadir el bot a grupos o canales, con qué avisos recibe cada uno.
 */
export function TelegramConnect() {
  const chats = useMyChats()
  const createCode = useCreateChatLinkCode('telegram')
  const [code, setCode] = useState<TelegramLinkCodeDTO | null>(null)

  if (!chats.data?.telegram.configured) return null
  const list = chats.data.chats.filter((c) => c.provider === 'telegram')
  const hasPrivate = list.some((c) => c.chatType === 'private' && c.active)

  const newCode = (then?: (c: TelegramLinkCodeDTO) => void, onFail?: () => void) =>
    createCode.mutate(undefined, {
      onSuccess: (c) => {
        // El flujo privado abre el bot directamente: las instrucciones son solo para grupos
        if (then) then(c)
        else setCode(c)
      },
      onError: () => onFail?.(),
    })

  return (
    <div className="space-y-2 border-b border-white/10 p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Send className="h-3.5 w-3.5" aria-hidden /> Telegram
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Recibe en Telegram los avisos de la 🔔 campanita y, si quieres, todos los lanzamientos y tesis. También puedes
        añadir el bot a tus grupos o canales.
      </p>

      <div className="flex flex-wrap gap-2">
        {!hasPrivate && (
          <Button
            size="sm"
            disabled={createCode.isPending}
            // La ventana se abre antes de la petición: si no, el navegador la bloquea
            onClick={() => {
              const win = window.open('about:blank', '_blank')
              newCode(
                (c) => {
                  if (win) win.location.href = c.links.private
                  else window.location.assign(c.links.private)
                },
                () => win?.close()
              )
            }}
            className="h-8 gap-1.5 rounded-lg bg-[#229ED9] px-3 text-xs font-bold text-white hover:bg-[#1c8cc2]"
          >
            {createCode.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Conectar mi Telegram
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={createCode.isPending}
          onClick={() => newCode()}
          className="h-8 gap-1.5 rounded-lg border-white/10 px-3 text-xs font-semibold"
        >
          <Users className="h-3.5 w-3.5" /> Añadir a un grupo o canal
        </Button>
      </div>

      {code && <GroupInstructions code={code} />}

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

function GroupInstructions({ code }: { code: TelegramLinkCodeDTO }) {
  const command = `/link ${code.code}`
  const expires = new Date(code.expiresAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="space-y-2 rounded-xl border border-[#229ED9]/25 bg-[#229ED9]/5 p-3 text-[12px] leading-relaxed">
      <p className="font-semibold">Para un grupo:</p>
      <p className="text-muted-foreground">
        <a href={code.links.group} target="_blank" rel="noreferrer" className="font-semibold text-[#5cc0f0] hover:underline">
          Añade el bot a tu grupo
        </a>{' '}
        (hazlo administrador). Se conectará solo con tu código.
      </p>
      <p className="font-semibold">Para un canal (o si el grupo no se conectó):</p>
      <p className="text-muted-foreground">
        <a href={code.links.channel} target="_blank" rel="noreferrer" className="font-semibold text-[#5cc0f0] hover:underline">
          Añade el bot como administrador
        </a>{' '}
        y publica este mensaje en el chat:
      </p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(command).then(() => toast.success('Copiado'))
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
