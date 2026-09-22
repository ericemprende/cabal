'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Chapa } from '@/components/cabal/chapa'
import { ActivityStream } from '@/components/cabal/sidebars'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { Silueta } from '@/lib/siluetas'
import { cn } from '@/lib/utils'
import { useUI, type TabKey } from '@/lib/store'
import { useGoToTab } from '@/lib/use-go-to-tab'
import { useOnlineCount } from '@/lib/presence'
import { useChatUnread } from '@/lib/chat-unread'

type NavTab = { key: TabKey; label: string; silueta: Silueta }

/**
 * Barra inferior del móvil: cuatro secciones y el botón de publicar en medio.
 *
 * Eran cinco secciones y se hacían demasiadas: con seis objetivos en una barra
 * de 360 px cada uno baja de los 48 px que hace falta para acertar con el dedo.
 * El Chat se salió de aquí y vive en los botones flotantes de la izquierda,
 * junto con la Actividad: son las dos cosas que cambian solas mientras miras
 * otra sección, así que ganan con un sitio propio donde el contador se ve
 * siempre, estés donde estés.
 */
const LEFT: NavTab[] = [
  { key: 'radar', label: 'Radar', silueta: 'radar-sweep' },
  { key: 'tokens', label: 'Tokens', silueta: 'coins-pile' },
]
const RIGHT: NavTab[] = [
  // El Feed son las tesis escritas: la pluma y el pergamino, que la burbuja de
  // chat es del Chat y tenerlas las dos confundía una cosa con la otra.
  { key: 'feed', label: 'Feed', silueta: 'scroll-quill' },
  { key: 'leaderboard', label: 'Líderes', silueta: 'laurels-trophy' },
]

export function MobileNav() {
  const { tab } = useUI()
  // Desde un perfil también hay que volver a /app para ver la sección
  const setTab = useGoToTab()
  const button = (t: NavTab) => (
    <NavButton key={t.key} label={t.label} silueta={t.silueta} active={tab === t.key} onClick={() => setTab(t.key)} />
  )
  return (
    <>
      <FloatingButtons />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0b08]/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación principal"
      >
        <div className="mx-auto grid max-w-md grid-cols-[1fr_1fr_3.5rem_1fr_1fr] items-end px-1">
          {LEFT.map(button)}
          <Link
            href="/publicar"
            className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground neon-shadow-strong transition-transform active:scale-95"
            aria-label="Publicar lanzamiento"
          >
            <Plus className="h-6 w-6" strokeWidth={3} />
          </Link>
          {RIGHT.map(button)}
        </div>
      </nav>
    </>
  )
}

/**
 * Los dos flotantes de la esquina inferior izquierda, uno encima del otro:
 * arriba la Actividad (todo lo que está pasando: launches y tesis), abajo el
 * Chat. Es lo que en escritorio es la columna lateral; aquí no cabe una
 * columna, así que la Actividad se abre en un panel a pantalla casi completa.
 */
function FloatingButtons() {
  const [activityOpen, setActivityOpen] = useState(false)
  return (
    <>
      <ActivityFab open={activityOpen} onOpen={() => setActivityOpen(true)} />
      <ChatFab />

      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent
          side="bottom"
          className="h-[85dvh] gap-0 rounded-t-2xl border-white/10 bg-[#0a0b08] p-0 md:hidden"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <Chapa silueta="lightning-arc" metal="verde" className="h-5 w-5" placa />
            <SheetTitle className="font-display text-base font-bold">Actividad del Cabal</SheetTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-6 pt-3">
            {/* Sin la pestaña de Chat: aquí el Chat es el botón de al lado */}
            <ActivityStream withChat={false} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Actividad: el flotante de arriba. Lleva el punto de "hay cosas nuevas" vivo. */
function ActivityFab({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="Actividad del Cabal: launches y tesis en vivo"
      aria-expanded={open}
      // Justo encima del flotante del Chat (48 px de alto + 8 px de aire)
      className={cn(
        'fixed left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md transition-colors active:scale-95 md:hidden',
        open
          ? 'border-[#8FA83F]/60 bg-[#8FA83F]/20 text-primary'
          : 'border-white/12 bg-[#121410]/95 text-muted-foreground hover:text-foreground'
      )}
      style={{ bottom: 'calc(7.75rem + env(safe-area-inset-bottom))' }}
    >
      <span className="relative">
        <Chapa silueta="lightning-arc" metal={open ? 'verde' : 'acero'} className="h-5 w-5" placa />
        <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full border border-[#0a0b08] bg-primary live-dot" aria-hidden />
      </span>
    </button>
  )
}

/**
 * El Chat de los usuarios: el flotante de abajo, con el contador de mensajes
 * sin leer y el punto de "hay gente conectada". Lleva burbuja de chat y se
 * llama Chat a secas, porque con el nombre de Radio se confundía con Radio
 * Cabal, que es el personaje que te explica la plataforma (abajo a la derecha).
 * En escritorio esto no existe: allí el Chat vive en la columna de Actividad.
 */
function ChatFab() {
  const { tab } = useUI()
  const setTab = useGoToTab()
  const onlineCount = useOnlineCount()
  const unread = useChatUnread()
  const active = tab === 'chat'
  const badge = !active && unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined
  return (
    <button
      onClick={() => setTab('chat')}
      aria-label={badge ? `Chat, ${badge} mensajes sin leer` : 'Chat'}
      aria-current={active ? 'page' : undefined}
      // Se apoya sobre la barra (56 px de alto) más el hueco del iPhone
      className={cn(
        'fixed left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md transition-colors active:scale-95 md:hidden',
        active
          ? 'border-[#8FA83F]/60 bg-[#8FA83F]/20 text-primary'
          : 'border-white/12 bg-[#121410]/95 text-muted-foreground hover:text-foreground'
      )}
      style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
    >
      <span className="relative">
        <Chapa silueta="chat-bubble" metal={active ? 'verde' : 'acero'} className="h-5 w-5" placa />
        {badge ? (
          <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#0a0b08] bg-primary px-1 text-[9px] font-black leading-none text-primary-foreground">
            {badge}
          </span>
        ) : (
          onlineCount > 0 && (
            <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full border border-[#0a0b08] bg-emerald-400" aria-hidden />
          )
        )}
      </span>
    </button>
  )
}

function NavButton({
  label,
  silueta,
  active,
  onClick,
}: {
  label: string
  silueta: Silueta
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Chapa silueta={silueta} metal={active ? 'verde' : 'acero'} className="h-5 w-5" placa />
      <span>{label}</span>
    </button>
  )
}
