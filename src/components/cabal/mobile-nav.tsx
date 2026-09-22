'use client'

import Link from 'next/link'
import { Radar, Coins, Rss, Trophy, Plus, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUI, type TabKey } from '@/lib/store'
import { useGoToTab } from '@/lib/use-go-to-tab'
import { useOnlineCount } from '@/lib/presence'
import { useChatUnread } from '@/lib/chat-unread'

type NavTab = { key: TabKey; label: string; icon: typeof Radar }

/**
 * Barra inferior del móvil: cuatro secciones y el botón de publicar en medio.
 *
 * Eran cinco secciones y se hacían demasiadas: con seis objetivos en una barra
 * de 360 px cada uno baja de los 48 px que hace falta para acertar con el dedo.
 * La Radio (el chat en vivo) se salió de aquí y vive en el botón flotante de la
 * izquierda: es lo único que avisa por su cuenta, así que gana con un sitio
 * propio donde el contador se ve siempre, esté donde esté el usuario.
 */
const LEFT: NavTab[] = [
  { key: 'radar', label: 'Radar', icon: Radar },
  { key: 'tokens', label: 'Tokens', icon: Coins },
]
const RIGHT: NavTab[] = [
  { key: 'feed', label: 'Feed', icon: Rss },
  { key: 'leaderboard', label: 'Líderes', icon: Trophy },
]

export function MobileNav() {
  const { tab } = useUI()
  // Desde un perfil también hay que volver a /app para ver la sección
  const setTab = useGoToTab()
  const button = (t: NavTab) => (
    <NavButton key={t.key} label={t.label} icon={t.icon} active={tab === t.key} onClick={() => setTab(t.key)} />
  )
  return (
    <>
      <ChatFab />
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
 * La Radio, flotando sobre la esquina inferior izquierda y por encima de la
 * barra. Lleva el contador de mensajes sin leer y el punto de "hay gente
 * conectada", que es lo que antes enseñaba en la barra; en escritorio esto no
 * existe porque ahí está la columna de Actividad del Cabal.
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
      aria-label={badge ? `Radio, ${badge} mensajes sin leer` : 'Radio'}
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
        <Radio className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
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
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon: typeof Radar
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
      <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
      <span>{label}</span>
    </button>
  )
}
