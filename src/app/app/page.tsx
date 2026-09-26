'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Coins, MessageCircle, MessageSquare, Radar as RadarIcon, Radar as RadarTabIcon, Trophy, Zap } from 'lucide-react'
import { Header } from '@/components/cabal/header'
import { MobileNav } from '@/components/cabal/mobile-nav'
import { Ticker } from '@/components/cabal/ticker'
import { BoostTicker } from '@/components/cabal/boost-hero'
import { LeftFeed, RightRail } from '@/components/cabal/sidebars'
import { RadarTab } from '@/components/cabal/radar-tab'
import { TokensTab } from '@/components/cabal/tokens-tab'
import { FeedTab } from '@/components/cabal/feed-tab'
import { LeaderboardTab } from '@/components/cabal/leaderboard-tab'
import { LaunchDetailDialog } from '@/components/cabal/launch-detail'
import { TokenDetailDialog } from '@/components/cabal/token-detail'
import { ProfileDialog } from '@/components/cabal/profile-dialog'
import { AdminDialog } from '@/components/cabal/admin-dialog'
import { PremiumDialog } from '@/components/cabal/premium-dialog'
import { AmmoDialog } from '@/components/cabal/ammo-dialog'
import { WelcomeShareDialog } from '@/components/cabal/welcome-share-dialog'
import { DonateDialog } from '@/components/cabal/donate-dialog'
import { DonateThanksDialog } from '@/components/cabal/donate-thanks-dialog'
import { GuideAssistant } from '@/components/cabal/guide-assistant'
import { LiveChat } from '@/components/cabal/live-chat'
import { useT } from '@/lib/i18n/provider'
import { useUI, type TabKey } from '@/lib/store'
import { qk, useConfirmPremiumCheckout, useMe, usePointRules } from '@/lib/api-client'
import { usePresenceConnection } from '@/lib/presence'
import { cn } from '@/lib/utils'

export default function Home() {
  const t = useT()
  const { tab, setSearchOpen, setAdminOpen, setWelcomeShareOpen } = useUI()
  const { data: me } = useMe()
  const rules = usePointRules()
  // Un solo socket de presencia para toda la app: alimenta el puntico verde
  // de "conectado" en avatares (top callers, líderes, perfiles) y el chat.
  usePresenceConnection()
  // Se lee una sola vez al montar para que la carga async de /api/me no lo pierda
  const [wantsAdmin] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1'
  )

  // Sección por URL: /app?tab=chat|tokens|feed|leaderboard. Lo usan los
  // accesos directos del icono de la app instalada y los enlaces de los bots.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab')
    const valid: TabKey[] = ['radar', 'tokens', 'feed', 'leaderboard', 'chat']
    if (wanted && (valid as string[]).includes(wanted)) {
      useUI.getState().setTab(wanted as TabKey)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

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

  // Deep link de un launch (enlaces del bot de Telegram y de los correos): /app?launch=<id>
  const openLaunch = useUI((s) => s.openLaunch)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const launchId = params.get('launch')
    if (!launchId) return
    params.delete('launch')
    const rest = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''))
    openLaunch(launchId)
  }, [openLaunch])

  // Enlace compartido de un token: /app?token=<id> abre su detalle (con compra)
  const openToken = useUI((s) => s.openToken)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenId = params.get('token')
    if (!tokenId) return
    params.delete('token')
    const rest = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''))
    openToken(tokenId)
  }, [openToken])

  // Deep link del panel admin: /app?admin=1
  useEffect(() => {
    if (!wantsAdmin) return
    window.history.replaceState(null, '', window.location.pathname)
    if (me?.isAdmin) setAdminOpen(true)
  }, [wantsAdmin, me?.isAdmin, setAdminOpen])

  // Retorno del OAuth de X / Google / Discord: /?connected=x|google|discord
  // (&connect_error=, &login=1, &created=1). Discord solo verifica, nunca entra.
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
        taken: 'Esa cuenta ya está vinculada a otro perfil de Cabal',
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
      if (oauthReturn.created) setWelcomeShareOpen(true)
    } else if (oauthReturn.provider) {
      const names: Record<string, string> = { x: 'X', google: 'Google', discord: 'Discord' }
      const name = names[oauthReturn.provider] ?? oauthReturn.provider
      toast.success(`Cuenta de ${name} verificada`, {
        // Sin cifra: los puntos de Discord son editables desde el panel, y el
        // total exacto ya se ve al instante en el balance del perfil.
        description: 'Puntos Cabal abonados por verificar tu identidad',
      })
    }
  }, [oauthReturn, qc])

  // Vuelta del pago Premium: /app?premium=ok&session_id=… (tarjeta), premium=crypto,
  // premium=cancel o premium=portal (ver createStripeCheckout / createStripeCheckout).
  const confirmCheckout = useConfirmPremiumCheckout()
  const [premiumReturn] = useState(() => {
    if (typeof window === 'undefined') return null
    const sp = new URLSearchParams(window.location.search)
    const status = sp.get('premium')
    if (!status) return null
    const sessionId = sp.get('session_id')
    window.history.replaceState(null, '', window.location.pathname)
    return { status, sessionId }
  })

  useEffect(() => {
    if (!premiumReturn) return
    if (premiumReturn.status === 'ok' && premiumReturn.sessionId) {
      confirmCheckout.mutate(premiumReturn.sessionId, {
        onSuccess: () => toast.success('¡Ya eres Premium!', { description: 'La información completa ya está desbloqueada' }),
        onError: () =>
          toast.error('No pudimos confirmar el pago todavía', {
            description: 'Si el cobro se completó, tu cuenta se activará en unos minutos',
          }),
      })
    } else if (premiumReturn.status === 'crypto') {
      toast.info('Factura generada', {
        description: 'Tu Premium se activa en cuanto la red confirme el pago (puede tardar varios minutos)',
      })
    } else if (premiumReturn.status === 'cancel') {
      toast('Pago cancelado')
    } else if (premiumReturn.status === 'portal') {
      qc.invalidateQueries({ queryKey: qk.me })
    }
  }, [premiumReturn])

  // Vuelta de la donación: /app?donated=<id> abre la pantalla de gracias con la
  // tarjeta para X (ver lib/donate-server.ts); donated=cancel es que cerró la
  // factura sin pagar.
  const [donateReturn] = useState(() => {
    if (typeof window === 'undefined') return null
    const value = new URLSearchParams(window.location.search).get('donated')
    if (!value) return null
    window.history.replaceState(null, '', window.location.pathname)
    return value
  })

  useEffect(() => {
    if (!donateReturn) return
    if (donateReturn === 'cancel') {
      toast('Donación cancelada', { description: 'Sigues siendo parte del Cabal igual 🫡' })
      return
    }
    useUI.getState().setDonateThanksId(donateReturn)
  }, [donateReturn])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Cinta de boosts: se ve en todas las pestañas, no solo en el Radar */}
      <BoostTicker />

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 pb-24 pt-4 sm:px-4 md:pb-12">
        <div className="flex gap-5">
          <LeftFeed />

          <div className="min-w-0 flex-1">
            {/* Desktop tab bar */}
            <div className="mb-4 hidden items-center gap-1 md:flex" role="tablist" aria-label={t.nav.sections}>
              <TabButton active={tab === 'radar'} onClick={() => useUI.getState().setTab('radar')} icon={RadarTabIcon} label={t.nav.radar} />
              <TabButton active={tab === 'tokens'} onClick={() => useUI.getState().setTab('tokens')} icon={Coins} label={t.nav.tokens} />
              <TabButton active={tab === 'feed'} onClick={() => useUI.getState().setTab('feed')} icon={MessageSquare} label={t.nav.feed} />
              <TabButton active={tab === 'leaderboard'} onClick={() => useUI.getState().setTab('leaderboard')} icon={Trophy} label={t.nav.leaders} />
            </div>

            {/* Mobile section title */}
            <div className="mb-3 flex items-center gap-2 md:hidden">
              {tab === 'chat' ? (
                <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <RadarIcon className="h-4 w-4 text-primary" aria-hidden />
              )}
              <h1 className="font-display text-lg font-bold capitalize">
                {tab === 'leaderboard'
                  ? t.nav.leaders
                  : tab === 'chat'
                    ? t.chat.title
                    : tab === 'tokens'
                      ? t.nav.tokens
                      : tab === 'feed'
                        ? t.nav.feed
                        : t.nav.radarShort}
              </h1>
            </div>

            <div role="tabpanel" aria-label={tab}>
              {tab === 'radar' && <RadarTab />}
              {tab === 'tokens' && <TokensTab />}
              {tab === 'feed' && <FeedTab />}
              {tab === 'leaderboard' && <LeaderboardTab />}
              {/* Alto de pantalla menos header, título y barra inferior */}
              {tab === 'chat' && <LiveChat showUnavailable className="h-[calc(100dvh-12rem)] min-h-[320px] md:h-[600px]" />}
            </div>
          </div>

          <RightRail />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 pb-16 pt-6 md:pb-10" style={{ marginBottom: 0 }}>
        <div className="mx-auto flex max-w-[1800px] flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            <span className="font-machina font-bold uppercase tracking-[0.08em] text-foreground">Cabal</span> ·{' '}
            {t.appFooter.tagline}
          </p>
          <p className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-primary/70" aria-hidden />{' '}
            {t.appFooter.points(rules.points_thesis, rules.points_launch)}
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
      <PremiumDialog />
      <AmmoDialog />
      <WelcomeShareDialog />
      <DonateDialog />
      <DonateThanksDialog />
      <GuideAssistant />
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
