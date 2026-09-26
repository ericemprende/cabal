'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, ChevronDown, CornerUpLeft, Crown, Eye, LogIn, LogOut, Plus, Search, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { CabalWordmark, CountdownPill, NetworkBadge, PointsPill, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { AuthDialog } from '@/components/cabal/auth-dialog'
import { AffiliatesDialog } from '@/components/cabal/affiliates-dialog'
import { useLaunches, useLeaderboard, useLogout, useMe, useOnlineNow, useSession, useTokens, useUserSearch } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { LangSwitch } from '@/components/cabal/lang-switch'
import { Chapa } from '@/components/cabal/chapa'
import { ContractResult, isContractAddress } from '@/components/cabal/contract-buy'
import { AmmoBadge } from '@/components/cabal/ammo'
import { DonateButton } from '@/components/cabal/donate-dialog'
import { useGoToTab } from '@/lib/use-go-to-tab'
import { timeAgo } from '@/lib/cabal'
import { useChatReplies } from '@/lib/chat-replies'

export function Header() {
  const t = useT()
  const { data: me } = useMe()
  const { data: session } = useSession()
  const { data: launches } = useLaunches()
  const { data: leaderboard } = useLeaderboard()
  const router = useRouter()
  const logout = useLogout()
  const { setSearchOpen, setProfileOpen, setAdminOpen, setAffiliatesOpen, setPremiumOpen, setTab, openLaunch, openAuth } = useUI()
  const goToTab = useGoToTab()
  const loggedIn = !!session?.loggedIn
  const chatReplies = useChatReplies(loggedIn ? me?.id : undefined)
  const { data: presence } = useOnlineNow(loggedIn)

  const soon = useMemo(() => {
    if (!launches) return []
    const now = Date.now()
    return launches
      .filter((l) => new Date(l.launchAt).getTime() > now && new Date(l.launchAt).getTime() < now + 36 * 3600_000)
      .sort((a, b) => +new Date(a.launchAt) - +new Date(b.launchAt))
      .slice(0, 5)
  }, [launches])

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0b08]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-3 px-3 sm:px-4">
        <button
          className="flex shrink-0 cursor-pointer items-center outline-none transition-opacity hover:opacity-80"
          onClick={() => goToTab('radar')}
          aria-label={t.header.goToRadar}
        >
          <CabalWordmark className="h-9 sm:h-10" />
        </button>

        {/* Donaciones: pegado al logo, que es donde primero se mira */}
        <DonateButton className="shrink-0" />

        {/* Search (desktop) — en el centro de la barra */}
        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-white/10 bg-[#121410] px-3 text-sm text-muted-foreground transition-colors hover:border-[#8FA83F]/30"
            aria-label={t.header.searchAria}
          >
            <Search className="h-4 w-4" />
            <span className="truncate">{t.header.searchPlaceholder}</span>
            <kbd className="ml-auto shrink-0 rounded border border-white/10 px-1.5 text-[10px] text-muted-foreground">/</kbd>
          </button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Munición: la granada con el saldo de balas, arriba a la derecha */}
          <AmmoBadge />

          {/* Usuarios en vivo: el número solo lo ve Premium; al resto se le
              enseña el candado, que abre el plan. */}
          {loggedIn && presence && (
            <button
              onClick={() => !presence.premium && setPremiumOpen(true)}
              title={presence.premium && presence.online !== null ? t.header.onlineNow(presence.online) : t.header.onlineLocked}
              aria-label={presence.premium && presence.online !== null ? t.header.onlineNow(presence.online) : t.header.onlineLocked}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-[#121410] px-2.5 text-xs font-semibold tabular-nums',
                presence.premium ? 'cursor-default text-foreground' : 'cursor-pointer text-muted-foreground hover:border-amber-300/40'
              )}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8FA83F] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#8FA83F]" />
              </span>
              {presence.premium && presence.online !== null ? presence.online.toLocaleString() : <Crown className="h-3.5 w-3.5 text-amber-300" />}
            </button>
          )}

          {me && <PointsPill points={me.points} className="hidden sm:inline-flex" />}

          <Button
            size="sm"
            onClick={() => router.push('/publicar')}
            className="neon-shadow hidden sm:inline-flex"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            {t.header.publishLaunch}
          </Button>

          {/* El idioma, a mano en la propia barra: no hace falta entrar en
              ajustes para cambiarlo. */}
          <LangSwitch className="hidden sm:flex" />

          {/* Notifications */}
          <Popover onOpenChange={(open) => open && chatReplies.markSeen()}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-muted-foreground hover:text-primary"
                aria-label={chatReplies.unread > 0 ? t.notifications.withUnread(chatReplies.unread) : t.notifications.label}
              >
                {/* La campanita solo se mueve cuando hay algo sin leer de verdad.
                    Antes bastaba con que hubiera un launch proximo para tenerla
                    palpitando siempre, que es como no avisar de nada. */}
                <Chapa
                  silueta="ringing-bell"
                  metal="oro"
                  className={cn('h-[18px] w-[18px]', chatReplies.unread > 0 && 'bell-swing')}
                  placa
                />
                {chatReplies.unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-[#0a0b08]">
                    {chatReplies.unread > 99 ? '99+' : chatReplies.unread}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 border-white/10 bg-popover p-2">
              {chatReplies.replies.length > 0 && (
                <div className="mb-1.5 border-b border-white/10 pb-1.5">
                  <p className="flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.notifications.chatReplies}
                    {chatReplies.unread > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{chatReplies.unread}</span>
                    )}
                  </p>
                  {chatReplies.replies.slice(0, 5).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => goToTab('chat')}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <UserAvatar name={r.user.name} handle={r.user.handle} src={r.user.avatar} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">
                          <span className="font-semibold">{r.user.name}</span>{' '}
                          <span className="text-muted-foreground">· {timeAgo(r.createdAt)}</span>
                        </p>
                        <p className="truncate text-[12px] text-foreground/90">{r.body}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                          <CornerUpLeft className="h-3 w-3 shrink-0" aria-hidden /> {r.replyTo?.body}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.notifications.upcoming}
              </p>
              {soon.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground">{t.notifications.nothingSoon}</p>
              )}
              {soon.map((l) => (
                <button
                  key={l.id}
                  onClick={() => openLaunch(l.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
                >
                  <TokenGlyph src={l.image} ticker={l.ticker ?? l.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {l.isPrivate || !l.ticker ? (
                        <span className="text-amber-300/90">{t.notifications.private}</span>
                      ) : (
                        l.ticker
                      )}{' '}
                      <span className="font-normal text-muted-foreground">· {l.name}</span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <NetworkBadge network={l.network} />
                      <span className="text-[11px] text-muted-foreground">
                        {timeAgo(l.createdAt)} {t.notifications.posted}
                      </span>
                    </div>
                  </div>
                  <CountdownPill target={l.launchAt} size="sm" estimated={!l.dateConfirmed} />
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Autenticación */}
          {loggedIn ? (
            /* Cuenta logueada: menú con cerrar sesión */
            <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-full outline-none" aria-label={t.header.userMenu}>
                  <UserAvatar
                    name={me?.name}
                    handle={me?.handle}
                    src={me?.avatar}
                    size="sm"
                    verified={me?.walletVerified} official={me?.verified}
                    premium={me?.premium.active}
                  />
                  <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 border-white/10 bg-popover">
                <DropdownMenuLabel className="flex items-center gap-2.5 pb-2">
                  <UserAvatar name={me?.name} handle={me?.handle} src={me?.avatar} size="sm" premium={me?.premium.active} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{me?.name ?? t.header.you}</p>
                    <p className="truncate text-xs text-muted-foreground">@{me?.handle ?? 'tu'}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#8FA83F]/10" />
                {me && (
                  <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                    <span className="text-muted-foreground">{t.header.points}</span>
                    <PointsPill points={me.points} />
                  </div>
                )}
                <DropdownMenuSeparator className="bg-[#8FA83F]/10" />
                {me?.handle && (
                  <DropdownMenuItem onClick={() => router.push(`/u/${me.handle}`)} className="gap-2 text-[13px]">
                    <Eye className="h-4 w-4" /> {t.header.viewProfile}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setProfileOpen(true)} className="gap-2 text-[13px]">
                  <UserRound className="h-4 w-4" /> {t.header.myCabal}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAffiliatesOpen(true)} className="gap-2 text-[13px]">
                  <Users className="h-4 w-4" /> {t.header.affiliates}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPremiumOpen(true)} className="gap-2 text-[13px] text-amber-300 focus:text-amber-300">
                  <Crown className="h-4 w-4 fill-amber-300" /> {me?.premium.active ? t.header.premiumOn : t.header.premiumOff}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchOpen(true)} className="gap-2 text-[13px] md:hidden">
                  <Search className="h-4 w-4" /> {t.header.search}
                </DropdownMenuItem>
                {me?.isAdmin && (
                  <DropdownMenuItem onClick={() => setAdminOpen(true)} className="gap-2 text-[13px] text-primary focus:text-primary">
                    <ShieldCheck className="h-4 w-4" /> {t.header.admin}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-[#8FA83F]/10" />
                <DropdownMenuItem
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="gap-2 text-[13px] text-[#ff8080] focus:text-[#ff8080]"
                >
                  <LogOut className="h-4 w-4" /> {logout.isPending ? t.header.loggingOut : t.header.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            /* Invitado: un solo botón → abre el acceso (dentro se puede iniciar sesión o crear cuenta) */
            <div className="flex items-center gap-1.5">
              {me?.isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAdminOpen(true)}
                  className="h-9 w-9 text-muted-foreground hover:text-primary"
                  aria-label={t.header.admin}
                  title={t.header.admin}
                >
                  <ShieldCheck className="h-[18px] w-[18px]" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => openAuth('login')}
                className="gap-1.5 px-3 text-[13px] font-bold"
              >
                <LogIn className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{t.header.login}</span>
                <span className="sm:hidden">{t.header.loginShort}</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <SearchDialog
        launches={launches ?? []}
        users={leaderboard?.callers.map((c) => c.user) ?? []}
        onOpenLaunch={openLaunch}
      />
      <AuthDialog />
      <AffiliatesDialog />
    </header>
  )
}

function SearchDialog({
  launches,
  users,
  onOpenLaunch,
}: {
  launches: { id: string; name: string; ticker: string | null; isPrivate: boolean; image?: string | null; network: string; launchAt: string; contract?: string | null }[]
  users: { id: string; name: string; handle: string; avatar: string; points: number }[]
  onOpenLaunch: (id: string) => void
}) {
  const t = useT()
  const { searchOpen, setSearchOpen, openToken } = useUI()
  const router = useRouter()
  const [q, setQ] = useState('')
  const { data: tokens } = useTokens('trending', 'all')

  const ql = q.trim().toLowerCase()
  // Un contrato pegado: se muestra su gráfico y su botón de compra aunque el
  // token no esté publicado en Cabal.
  const isCa = isContractAddress(q)
  const { data: foundUsers } = useUserSearch(q)

  const matches = (haystack: string, contract?: string | null) =>
    haystack.toLowerCase().includes(ql) || (!!contract && contract.toLowerCase() === ql)

  const fLaunches = ql
    ? launches.filter((l) => matches(`${l.name} ${l.ticker ?? ''}`, l.contract)).slice(0, 4)
    : launches.slice(0, 3)
  const fTokens = ql
    ? (tokens ?? []).filter((t) => matches(`${t.name} ${t.ticker}`, t.contract)).slice(0, 4)
    : (tokens ?? []).slice(0, 3)
  // Con algo escrito manda la búsqueda del servidor (cualquier persona de
  // Cabal); en blanco, los top callers como sugerencia.
  const fUsers = ql
    ? (foundUsers ?? users.filter((u) => `${u.name} ${u.handle}`.toLowerCase().includes(ql))).slice(0, 5)
    : users.slice(0, 3)

  const openProfile = (handle: string) => {
    router.push(`/u/${handle}`)
  }

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent
        className={cn(
          'overflow-y-auto border-white/10 bg-[#121410] p-0',
          // Con un contrato pegado se abre casi a pantalla completa para que el gráfico se lea bien
          isCa ? 'max-h-[94dvh] sm:max-w-[min(1400px,95vw)]' : 'max-h-[80dvh] sm:max-w-lg'
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t.search.title}</DialogTitle>
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#121410] p-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a0b08] px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search.placeholder}
              className="h-10 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
              aria-label={t.search.aria}
            />
          </div>
        </div>
        <div className="space-y-4 p-3">
          {isCa && (
            <div>
              <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.search.contract}
              </p>
              <ContractResult ca={q.trim()} chartHeight={560} />
            </div>
          )}
          {[
            { title: t.search.launches, kind: 'launch' as const, items: fLaunches.map((l) => ({ id: l.id, src: l.image, handle: '', ticker: l.ticker ?? l.name, main: `${l.ticker && !l.isPrivate ? `$${l.ticker} · ` : ''}${l.name}${l.isPrivate ? ` · ${t.search.private}` : ''}`, sub: l.network, onClick: () => onOpenLaunch(l.id), badge: <NetworkBadge network={l.network} /> })) },
            { title: t.search.liveTokens, kind: 'launch' as const, items: fTokens.map((t) => ({ id: t.id, src: t.image, handle: '', ticker: t.ticker, main: `${t.ticker} · ${t.name}`, sub: `$${t.mc >= 1e6 ? `${(t.mc / 1e6).toFixed(1)}M` : `${Math.round(t.mc / 1e3)}K`} MC`, onClick: () => openToken(t.id), badge: <NetworkBadge network={t.network} /> })) },
            { title: ql ? t.search.people : t.search.traders, kind: 'user' as const, items: fUsers.map((u) => ({ id: u.id, src: u.avatar, handle: u.handle, ticker: u.name, main: u.name, sub: `@${u.handle}`, onClick: () => openProfile(u.handle), badge: <PointsPill points={u.points} /> })) },
          ].map(
            (group) =>
              group.items.length > 0 && (
                <div key={group.title}>
                  <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={`${group.title}-${item.id}`}
                        onClick={() => {
                          item.onClick()
                          setSearchOpen(false)
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
                      >
                        {group.kind === 'user' ? (
                          <UserAvatar name={item.ticker} handle={item.handle} src={item.src || undefined} size="xs" ring={false} />
                        ) : (
                          <TokenGlyph src={item.src} ticker={item.ticker} size="xs" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.main}</p>
                          <p className="text-xs text-muted-foreground">{item.sub}</p>
                        </div>
                        {item.badge}
                      </button>
                    ))}
                  </div>
                </div>
              )
          )}
          {ql && !isCa && fLaunches.length === 0 && fTokens.length === 0 && fUsers.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t.search.noResults(q)}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
