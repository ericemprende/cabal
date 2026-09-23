'use client'

import { Chapa } from '@/components/cabal/chapa'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { useUI } from '@/lib/store'
import { LoginRequiredError, useMyReminders, useToggleReminder } from '@/lib/notify-client'
import { leadLabel } from '@/lib/notify-types'

/**
 * Campanita de un launch: avisa al usuario (Telegram y/o correo) cuando falta
 * una hora para el lanzamiento. No se muestra si el launch ya salió.
 */
export function ReminderBell({
  launchId,
  launchAt,
  size = 'sm',
  className,
}: {
  launchId: string
  launchAt: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const t = useT()
  const { data } = useMyReminders()
  const toggle = useToggleReminder()
  const { openAuth, setProfileOpen } = useUI()
  const on = data?.launchIds.includes(launchId) ?? false

  if (new Date(launchAt).getTime() <= Date.now()) return null

  // Se anuncia el primer aviso, que es el de mayor antelación
  const leads = data?.leads?.length ? data.leads : [60]
  const leadText = leadLabel(Math.max(...leads))

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggle.mutate(launchId, {
      onSuccess: ({ reminded, channels }) => {
        if (!reminded) return toast(t.reminder.off)
        const chat = channels.telegram ? 'Telegram' : channels.discord ? 'Discord' : null
        if (chat) return toast.success(t.reminder.onChat(chat, leadText))
        if (channels.email) {
          return toast.success(t.reminder.onEmail(leadText), {
            action: { label: t.reminder.addChat, onClick: () => setProfileOpen(true) },
          })
        }
        toast(t.reminder.noChannel, {
          description: t.reminder.noChannelBody,
          action: { label: t.reminder.connect, onClick: () => setProfileOpen(true) },
          duration: 8000,
        })
      },
      onError: (err) => {
        if (err instanceof LoginRequiredError) {
          toast(t.reminder.loginNeeded)
          openAuth('login')
        } else {
          toast.error(err.message || t.reminder.failed)
        }
      },
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? t.reminder.removeAria : t.reminder.setAria(leadText)}
      title={on ? t.reminder.onTitle : t.reminder.offTitle(leadText)}
      className={cn(
        // Sin placa ni fondo: a este tamaño el octogono tapaba el reloj y en el
        // pie oscuro de la tarjeta no se distinguia nada.
        'flex items-center justify-center rounded-full transition-all hover:brightness-125 active:scale-95',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        on && 'ring-1 ring-amber-300/60 bg-amber-400/15',
        className
      )}
    >
      <Chapa silueta="alarm-clock" metal="oro" className={size === 'sm' ? 'h-[22px] w-[22px]' : 'h-6 w-6'} />
    </button>
  )
}
