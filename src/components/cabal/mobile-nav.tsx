'use client'

import Link from 'next/link'
import { Radar, Coins, Rss, Trophy, Plus, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUI, type TabKey } from '@/lib/store'
import { useGoToTab } from '@/lib/use-go-to-tab'
import { useOnlineCount } from '@/lib/presence'

type NavTab = { key: TabKey; label: string; icon: typeof Radar }

// El botón de publicar queda centrado: tres secciones a cada lado
const LEFT: NavTab[] = [
  { key: 'radar', label: 'Radar', icon: Radar },
  { key: 'tokens', label: 'Tokens', icon: Coins },
  { key: 'feed', label: 'Feed', icon: Rss },
]
const RIGHT: NavTab[] = [
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'leaderboard', label: 'Líderes', icon: Trophy },
]

export function MobileNav() {
  const { tab } = useUI()
  // Desde un perfil también hay que volver a /app para ver la sección
  const setTab = useGoToTab()
  const onlineCount = useOnlineCount()
  const button = (t: NavTab) => (
    <NavButton
      key={t.key}
      label={t.label}
      icon={t.icon}
      active={tab === t.key}
      onClick={() => setTab(t.key)}
      dot={t.key === 'chat' && onlineCount > 0}
    />
  )
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0b08]/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto grid max-w-md grid-cols-[1fr_1fr_1fr_3.5rem_1fr_1fr] items-end px-1">
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
  )
}

function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
  dot,
}: {
  label: string
  icon: typeof Radar
  active: boolean
  onClick: () => void
  dot?: boolean
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
      <span className="relative">
        <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
        {dot && (
          <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border border-[#0a0b08] bg-emerald-400" aria-hidden />
        )}
      </span>
      <span>{label}</span>
    </button>
  )
}
