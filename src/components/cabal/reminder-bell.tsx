'use client'

import { Bell, BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUI } from '@/lib/store'
import { LoginRequiredError, useMyReminders, useToggleReminder } from '@/lib/notify-client'

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
  const { data } = useMyReminders()
  const toggle = useToggleReminder()
  const { openAuth, setProfileOpen } = useUI()
  const on = data?.launchIds.includes(launchId) ?? false

  if (new Date(launchAt).getTime() <= Date.now()) return null

  const lead = data?.leadMinutes ?? 60
  const leadText = lead % 60 === 0 ? `${lead / 60} hora${lead === 60 ? '' : 's'}` : `${lead} minutos`

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggle.mutate(launchId, {
      onSuccess: ({ reminded, channels }) => {
        if (!reminded) return toast('Aviso desactivado')
        if (channels.telegram) return toast.success(`Te avisaremos por Telegram ${leadText} antes`)
        if (channels.email) {
          return toast.success(`Te avisaremos por correo ${leadText} antes`, {
            action: { label: 'Añadir Telegram', onClick: () => setProfileOpen(true) },
          })
        }
        toast(`Aviso activado, pero aún no tienes dónde recibirlo`, {
          description: 'Conecta tu Telegram o verifica tu correo desde tu perfil.',
          action: { label: 'Conectar', onClick: () => setProfileOpen(true) },
          duration: 8000,
        })
      },
      onError: (err) => {
        if (err instanceof LoginRequiredError) {
          toast('Inicia sesión para recibir el aviso')
          openAuth('login')
        } else {
          toast.error(err.message || 'No se pudo activar el aviso')
        }
      },
    })
  }

  const Icon = on ? BellRing : Bell
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? 'Quitar aviso del lanzamiento' : `Avisarme ${leadText} antes del lanzamiento`}
      title={on ? 'Aviso activado · toca para quitarlo' : `Avisarme ${leadText} antes`}
      className={cn(
        'flex items-center justify-center rounded-full border transition-all active:scale-95',
        size === 'sm' ? 'h-[26px] w-[26px]' : 'h-8 w-8',
        on
          ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
          : 'border-white/10 text-muted-foreground hover:border-amber-400/40 hover:text-amber-300',
        className
      )}
    >
      <Icon className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', on && 'fill-amber-300/30')} aria-hidden />
    </button>
  )
}
