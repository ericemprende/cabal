'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Coins, MessageSquare, Radar as RadarIcon, Radar as RadarTabIcon, Trophy, Zap } from 'lucide-react'
import { Header } from '@/components/cabal/header'
import { MobileNav } from '@/components/cabal/mobile-nav'
import { Ticker } from '@/components/cabal/ticker'
import { LeftFeed, RightRail } from '@/components/cabal/sidebars'
import { RadarTab } from '@/components/cabal/radar-tab'
import { TokensTab } from '@/components/cabal/tokens-tab'
import { FeedTab } from '@/components/cabal/feed-tab'
import { LeaderboardTab } from '@/components/cabal/leaderboard-tab'
import { LaunchDetailDialog } from '@/components/cabal/launch-detail'
import { TokenDetailDialog } from '@/components/cabal/token-detail'
import { ProfileDialog } from '@/components/cabal/profile-dialog'
import { AdminDialog } from '@/components/cabal/admin-dialog'
import { useUI } from '@/lib/store'
import { qk, useMe } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export default function Home() {
  const { tab, setSearchOpen, setAdminOpen } = useUI()
  const { data: me } = useMe()
  // Se lee una sola vez al montar para que la carga async de /api/me no lo pierda
  const [wantsAdmin] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1'
  )

  // "/" abre la búsqueda como paleta de comandos
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

  // Deep link del panel admin: /?admin=1
  useEffect(() => {
    if (!wantsAdmin) return
    window.history.replaceState(null, '', window.location.pathname)
    if (me?.isAdmin) setAdminOpen(true)
  }, [wantsAdmin, me?.isAdmin, setAdminOpen])

  // Retorno del OAuth de X / Google: /?connected=x|google (&connect_error=, &login=1, &created=1)
  const qc = useQueryClient()
  const [oauthReturn] = useState(() => {
    if (typeof window === 'undefined') return null
    const sp = new URLSearchParams(window.location.search)
    const provider = sp.get('connected')
    const error = sp.get('connect_error')
    if (!provider && !error) return null
    window.history.replaceState(null, '', window.location.pathname)
    return {
      provider,
      error,
      isLogin: sp.get('login') === '1',
      created: sp.get('created') === '1',
    }
  })

  useEffect(() => {
    if (!oauthReturn) return
    qc.invalidateQueries({ queryKey: qk.me })
    qc.invalidateQueries({ queryKey: qk.authStatus })
    if (oauthReturn.error) {
      const msgs: Record<string, string> = {
        access_denied: 'Autorización cancelada en el proveedor',
        state: 'La sesión de verificación expiró, intenta de nuevo',
        token: 'El proveedor rechazó el intercambio del código',
        profile: 'No se pudo leer tu perfil del proveedor',
        no_config: 'Las API keys del proveedor no están configuradas',
        server: 'Error inesperado durante la verificación',
      }
      toast.error(msgs[oauthReturn.error] ?? 'No se pudo completar la operación')
    } else if (oauthReturn.provider && oauthReturn.isLogin) {
      // Vuelta de un login social real: la cookie de sesión ya está puesta
      qc.invalidateQueries()
      const prov = oauthReturn.provider === 'x' ? 'X' : 'Google'
      toast.success(
        oauthReturn.created ? `Cuenta creada con ${prov}` : `Sesión iniciada con ${prov}`,
        { description: 'Identidad verificada · +5 puntos Cabal' }
      )
    } else if (oauthReturn.provider) {
      toast.success(
        oauthReturn.provider === 'x' ? 'Cuenta de X verificada' : 'Cuenta de Google verificada',
        { description: '+5 puntos Cabal por verificar tu identidad' }
      )
    }
  }, [oauthReturn, qc])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 pb-24 pt-4 sm:px-4 md:pb-12">
        <div className="flex gap-5">
          <LeftFeed />

          <div className="min-w-0 flex-1">
            {/* Desktop tab bar */}
            <div className="mb-4 hidden items-center gap-1 md:flex" role="tablist" aria-label="Secciones">
              <TabButton active={tab === 'radar'} onClick={() => useUI.getState().setTab('radar')} icon={RadarTabIcon} label="Radar de Launches" />
              <TabButton active={tab === 'tokens'} onClick={() => useUI.getState().setTab('tokens')} icon={Coins} label="Tokens" />
              <TabButton active={tab === 'feed'} onClick={() => useUI.getState().setTab('feed')} icon={MessageSquare} label="Feed" />
              <TabButton active={tab === 'leaderboard'} onClick={() => useUI.getState().setTab('leaderboard')} icon={Trophy} label="Líderes" />
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
      <footer className="mt-auto border-t border-white/10 pb-16 pt-6 md:pb-10" style={{ marginBottom: 0 }}>
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            <span className="font-machina font-bold uppercase tracking-[0.08em] text-foreground">Cabal</span> · la comunidad que ve los launches antes que nadie
          </p>
          <p className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-primary/70" aria-hidden /> Tesis +25 · Launch +40 · Se canjean por $CABAL
          </p>
        </div>
      </footer>

      <Ticker />
      <MobileNav />

      {/* Dialogs */}
      <LaunchDetailDialog />
      <TokenDetailDialog />
      <ProfileDialog />
      <AdminDialog />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof RadarIcon
  label: string
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-all',
        active
          ? 'bg-[#8FA83F]/12 text-primary neon-shadow'
          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" aria-hidden strokeWidth={active ? 2.4 : 2} />
      {label}
    </button>
  )
}
