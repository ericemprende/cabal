'use client'

import { Chapa } from '@/components/cabal/chapa'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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
        if (!reminded) return toast('Aviso desactivado')
        const chat = channels.telegram ? 'Telegram' : channels.discord ? 'Discord' : null
        if (chat) return toast.success(`Te avisaremos por ${chat} ${leadText} antes`)
        if (channels.email) {
          return toast.success(`Te avisaremos por correo ${leadText} antes`, {
            action: { label: 'Añadir Telegram o Discord', onClick: () => setProfileOpen(true) },
          })
        }
        toast(`Aviso activado, pero aún no tienes dónde recibirlo`, {
          description: 'Conecta tu Telegram o tu Discord, o verifica tu correo desde tu perfil.',
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

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? 'Quitar aviso del lanzamiento' : `Avisarme ${leadText} antes del lanzamiento`}
      title={on ? 'Aviso activado · toca para quitarlo' : `Avisarme ${leadText} antes`}
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
