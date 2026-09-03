'use client'

import { useEffect } from 'react'
import { Radar as RadarIcon } from 'lucide-react'
import { Header } from '@/components/cabal/header'
import { MobileNav } from '@/components/cabal/mobile-nav'
import { Ticker } from '@/components/cabal/ticker'
import { LeftFeed, RightRail } from '@/components/cabal/sidebars'
import { RadarTab } from '@/components/cabal/radar-tab'
import { TokensTab } from '@/components/cabal/tokens-tab'
import { FeedTab } from '@/components/cabal/feed-tab'
import { LeaderboardTab } from '@/components/cabal/leaderboard-tab'
import { LaunchDetailDialog } from '@/components/cabal/launch-detail'
import { PostLaunchDialog } from '@/components/cabal/post-launch-dialog'
import { TokenDetailDialog } from '@/components/cabal/token-detail'
import { ProfileDialog } from '@/components/cabal/profile-dialog'
import { AdminDialog } from '@/components/cabal/admin-dialog'
import { useUI } from '@/lib/store'
import { cn } from '@/lib/utils'

export default function Home() {
  const { tab, setSearchOpen } = useUI()

  // "/" opens search like a command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 pb-24 pt-4 sm:px-4 md:pb-12">
        <div className="flex gap-5">
          <LeftFeed />

          <div className="min-w-0 flex-1">
            {/* Desktop tab bar */}
            <div className="mb-4 hidden items-center gap-1 md:flex" role="tablist" aria-label="Secciones">
              <TabButton active={tab === 'radar'} onClick={() => useUI.getState().setTab('radar')} icon="🛰" label="Radar de Launches" />
              <TabButton active={tab === 'tokens'} onClick={() => useUI.getState().setTab('tokens')} icon="🪙" label="Tokens" />
              <TabButton active={tab === 'feed'} onClick={() => useUI.getState().setTab('feed')} icon="💬" label="Feed" />
              <TabButton active={tab === 'leaderboard'} onClick={() => useUI.getState().setTab('leaderboard')} icon="🏆" label="Líderes" />
            </div>

            {/* Mobile section title */}
            <div className="mb-3 flex items-center gap-2 md:hidden">
              <RadarIcon className="h-4 w-4 text-primary" />
              <h1 className="font-display text-lg font-bold capitalize">{tab === 'leaderboard' ? 'líderes' : tab}</h1>
            </div>

            <div role="tabpanel" aria-label={tab}>
              {tab === 'radar' && <RadarTab />}
              {tab === 'tokens' && <TokensTab />}
              {tab === 'feed' && <FeedTab />}
              {tab === 'leaderboard' && <LeaderboardTab />}
            </div>
          </div>

          <RightRail />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#00ff88]/10 pb-16 pt-6 md:pb-10" style={{ marginBottom: 0 }}>
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            <span className="font-display font-bold text-primary">cabal</span> · la comunidad que ve los launches antes que nadie
          </p>
          <p>⚡ Tesis +25 · Launch +40 · Se canjean por $CABAL</p>
        </div>
      </footer>

      <Ticker />
      <MobileNav />

      {/* Dialogs */}
      <LaunchDetailDialog />
      <PostLaunchDialog />
      <TokenDetailDialog />
      <ProfileDialog />
      <AdminDialog />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2 text-[13px] font-bold transition-all',
        active
          ? 'bg-[#00ff88]/12 text-primary neon-shadow'
          : 'text-muted-foreground hover:bg-[#00ff88]/5 hover:text-foreground'
      )}
    >
      <span className="mr-1.5" aria-hidden>{icon}</span>
      {label}
    </button>
  )
}
