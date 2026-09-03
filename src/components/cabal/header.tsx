'use client'

import { useMemo, useState } from 'react'
import { Bell, ChevronDown, Plus, Search, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
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
import { useLaunches, useLeaderboard, useMe, useTokens } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { timeAgo } from '@/lib/cabal'

export function Header() {
  const { data: me } = useMe()
  const { data: launches } = useLaunches()
  const { data: leaderboard } = useLeaderboard()
  const { setPostLaunchOpen, setSearchOpen, setProfileOpen, setAdminOpen, setTab, openLaunch } = useUI()

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
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-3 sm:px-4">
        <button
          className="flex items-center outline-none"
          onClick={() => setTab('radar')}
          aria-label="Ir al Radar"
        >
          <CabalWordmark />
        </button>

        {/* Search (desktop) */}
        <button
          onClick={() => setSearchOpen(true)}
          className="ml-4 hidden h-9 w-full max-w-md items-center gap-2 rounded-lg border border-white/10 bg-[#121410] px-3 text-sm text-muted-foreground transition-colors hover:border-[#8FA83F]/30 md:flex"
          aria-label="Buscar tokens, launches o usuarios"
        >
          <Search className="h-4 w-4" />
          <span>Buscar tokens, launches o traders…</span>
          <kbd className="ml-auto rounded border border-white/10 px-1.5 text-[10px] text-muted-foreground">/</kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {me && <PointsPill points={me.points} className="hidden sm:inline-flex" />}

          <Button
            size="sm"
            onClick={() => setPostLaunchOpen(true)}
            className="neon-shadow hidden h-9 gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-bold text-primary-foreground hover:bg-[#8FA83F] sm:inline-flex"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            Publicar launch
          </Button>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-primary" aria-label="Notificaciones">
                <Bell className="h-[18px] w-[18px]" />
                {soon.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary live-dot" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 border-white/10 bg-popover p-2">
              <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Radar · Próximos lanzamientos
              </p>
              {soon.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground">Nada en las próximas 36h. Revisa el Radar.</p>
              )}
              {soon.map((l) => (
                <button
                  key={l.id}
                  onClick={() => openLaunch(l.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
                >
                  <TokenGlyph src={l.image} ticker={l.ticker} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {l.ticker} <span className="font-normal text-muted-foreground">· {l.name}</span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <NetworkBadge network={l.network} />
                      <span className="text-[11px] text-muted-foreground">{timeAgo(l.createdAt)} posteado</span>
                    </div>
                  </div>
                  <CountdownPill target={l.launchAt} size="sm" />
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-full outline-none" aria-label="Menú de usuario">
                <UserAvatar name={me?.name} handle={me?.handle} size="sm" verified={me?.walletVerified} />
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-white/10 bg-popover">
              <DropdownMenuLabel className="flex items-center gap-2.5 pb-2">
                <UserAvatar name={me?.name} handle={me?.handle} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{me?.name ?? 'Tú'}</p>
                  <p className="text-xs text-muted-foreground">@{me?.handle ?? 'tu'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#8FA83F]/10" />
              {me && (
                <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                  <span className="text-muted-foreground">Puntos Cabal</span>
                  <PointsPill points={me.points} />
                </div>
              )}
              <DropdownMenuSeparator className="bg-[#8FA83F]/10" />
              <DropdownMenuItem onClick={() => setProfileOpen(true)} className="gap-2 text-[13px]">
                <UserRound className="h-4 w-4" /> Mi Cabal (perfil)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchOpen(true)} className="gap-2 text-[13px] md:hidden">
                <Search className="h-4 w-4" /> Buscar
              </DropdownMenuItem>
              {me?.isAdmin && (
                <DropdownMenuItem onClick={() => setAdminOpen(true)} className="gap-2 text-[13px] text-primary focus:text-primary">
                  <ShieldCheck className="h-4 w-4" /> Dashboard Admin
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <SearchDialog
        launches={launches ?? []}
        users={leaderboard?.callers.map((c) => c.user) ?? []}
        onOpenLaunch={openLaunch}
      />
    </header>
  )
}

function SearchDialog({
  launches,
  users,
  onOpenLaunch,
}: {
  launches: { id: string; name: string; ticker: string; image?: string | null; network: string; launchAt: string }[]
  users: { id: string; name: string; handle: string; avatar: string; points: number }[]
  onOpenLaunch: (id: string) => void
}) {
  const { searchOpen, setSearchOpen, openToken } = useUI()
  const [q, setQ] = useState('')
  const { data: tokens } = useTokens('trending', 'all')

  const ql = q.trim().toLowerCase()
  const fLaunches = ql
    ? launches.filter((l) => `${l.name} ${l.ticker}`.toLowerCase().includes(ql)).slice(0, 4)
    : launches.slice(0, 3)
  const fTokens = ql ? (tokens ?? []).filter((t) => `${t.name} ${t.ticker}`.toLowerCase().includes(ql)).slice(0, 4) : (tokens ?? []).slice(0, 3)
  const fUsers = ql ? users.filter((u) => `${u.name} ${u.handle}`.toLowerCase().includes(ql)).slice(0, 4) : users.slice(0, 3)

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <div className="sticky top-0 border-b border-white/10 bg-[#121410] p-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a0b08] px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="SMOL, cryptonita, Base…"
              className="h-10 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
              aria-label="Buscar en Cabal"
            />
          </div>
        </div>
        <div className="space-y-4 p-3">
          {[
            { title: 'Lanzamientos · Radar', kind: 'launch' as const, items: fLaunches.map((l) => ({ id: l.id, src: l.image, ticker: l.ticker, main: `${l.ticker} · ${l.name}`, sub: l.network, onClick: () => onOpenLaunch(l.id), badge: <NetworkBadge network={l.network} /> })) },
            { title: 'Tokens en vivo', kind: 'launch' as const, items: fTokens.map((t) => ({ id: t.id, src: t.image, ticker: t.ticker, main: `${t.ticker} · ${t.name}`, sub: `$${t.mc >= 1e6 ? `${(t.mc / 1e6).toFixed(1)}M` : `${Math.round(t.mc / 1e3)}K`} MC`, onClick: () => openToken(t.id), badge: <NetworkBadge network={t.network} /> })) },
            { title: 'Traders', kind: 'user' as const, items: fUsers.map((u) => ({ id: u.id, src: '', ticker: u.name, main: u.name, sub: `@${u.handle}`, onClick: () => {}, badge: <PointsPill points={u.points} /> })) },
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
                          <UserAvatar name={item.ticker} size="xs" ring={false} />
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
          {ql && fLaunches.length === 0 && fTokens.length === 0 && fUsers.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sin resultados para “{q}”</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
