'use client'

import Link from 'next/link'
import { Radar, Coins, Rss, Trophy, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUI, type TabKey } from '@/lib/store'

const TABS: { key: TabKey; label: string; icon: typeof Radar }[] = [
  { key: 'radar', label: 'Radar', icon: Radar },
  { key: 'tokens', label: 'Tokens', icon: Coins },
  { key: 'feed', label: 'Feed', icon: Rss },
  { key: 'leaderboard', label: 'Líderes', icon: Trophy },
]

export function MobileNav() {
  const { tab, setTab } = useUI()
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0b08]/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
        {TABS.slice(0, 2).map((t) => (
          <NavButton key={t.key} label={t.label} icon={t.icon} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
        <Link
          href="/publicar"
          className="mx-auto -mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground neon-shadow-strong transition-transform active:scale-95"
          aria-label="Publicar lanzamiento"
        >
          <Plus className="h-6 w-6" strokeWidth={3} />
        </Link>
        {TABS.slice(2).map((t) => (
          <NavButton key={t.key} label={t.label} icon={t.icon} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
      </div>
    </nav>
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
        'flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
      <span>{label}</span>
    </button>
  )
}
