'use client'

import { useMemo, useState } from 'react'
import { Flame, Globe, MessageSquare, ShieldAlert, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { NetworkBadge, TokenGlyph, UserAvatar, OfficialBadge } from '@/components/cabal/shared'
import { BoostCounter } from '@/components/cabal/ammo'
import { QuickBuyButton } from '@/components/cabal/quick-buy'
import { ContractBuy } from '@/components/cabal/contract-buy'
import { fmtMc, fmtNum, fmtPct, fmtPrice, networkMeta, timeAgo } from '@/lib/cabal'
import { useTokens } from '@/lib/api-client'
import { useUI } from '@/lib/store'

const SORTS: { key: keyof ReturnType<typeof useT>['tokens']['sort']; icon: typeof Flame }[] = [
  { key: 'trending', icon: Flame },
  { key: 'new', icon: Sparkles },
  { key: 'winners', icon: TrendingUp },
  { key: 'losers', icon: TrendingDown },
  { key: 'risk', icon: ShieldAlert },
] as const

/**
 * Columnas de la lista. Estrecha: token, MC, 24h y comprar. Desde 42rem: red,
 * holders, dev y comentarios. Desde 52rem: también precio y volumen. Las
 * columnas ocultas van con `hidden`, así que cada plantilla lista solo las visibles.
 */
const GRID = cn(
  'grid items-center gap-2',
  'grid-cols-[minmax(0,1fr)_76px_60px_auto]',
  '@2xl:grid-cols-[minmax(0,1fr)_60px_92px_64px_64px_100px_132px]',
  '@[52rem]:grid-cols-[minmax(0,1fr)_60px_76px_92px_64px_64px_72px_100px_132px]'
)

const NETWORK_FILTERS = ['all', 'solana', 'base', 'ethereum', 'bsc', 'robinhood', 'arc', 'tron'] as const

export function TokensTab() {
  // `t` es cada token dentro de la lista: los textos se leen como `copy`.
  const copy = useT()
  const [sort, setSort] = useState<string>('trending')
  const [network, setNetwork] = useState<string>('all')
  const { data: tokens, isLoading } = useTokens(sort, network)
  const { openToken } = useUI()

  const maxMc = useMemo(() => Math.max(...(tokens ?? []).map((t) => t.mc), 1), [tokens])

  return (
    <div className="space-y-3">
      <ContractBuy />
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
              sort === s.key
                ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary neon-shadow'
                : 'border-white/10 bg-[#121410] text-muted-foreground hover:border-[#8FA83F]/30 hover:text-foreground'
            )}
          >
            <s.icon className="h-3.5 w-3.5" aria-hidden />
            {copy.tokens.sort[s.key]}
          </button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
        {NETWORK_FILTERS.map((n) => (
          <button
            key={n}
            onClick={() => setNetwork(n)}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition-all',
              network === n ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground'
            )}
          >
            {n === 'all' ? (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" aria-hidden /> {copy.radar.all}
              </span>
            ) : (
              networkMeta(n).short
            )}
          </button>
        ))}
      </div>

      {/* Cabecera y filas comparten la misma rejilla: cada dato cae bajo su título. Las
          columnas dependen del ancho de la lista (no de la pantalla), porque la columna
          central cambia según estén abiertas las barras laterales. */}
      <div className="@container">
        <div
          className={cn(
            GRID,
            'mb-1.5 hidden px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground @2xl:grid'
          )}
        >
          <span>{copy.tokens.col.token}</span>
          <span>{copy.tokens.col.network}</span>
          <span className="hidden text-right @[52rem]:block">{copy.tokens.col.price}</span>
          <span className="text-right">{copy.tokens.col.mc}</span>
          <span className="text-right">{copy.tokens.col.change}</span>
          <span className="text-right">{copy.tokens.col.holders}</span>
          <span className="hidden text-right @[52rem]:block">{copy.tokens.col.volume}</span>
          <span className="pl-2">{copy.tokens.col.dev}</span>
          <span />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[64px] animate-pulse rounded-xl border border-white/8 bg-[#121410]" />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {(tokens ?? []).map((t) => (
              <button
                key={t.id}
                onClick={() => openToken(t.id)}
                className={cn(
                  GRID,
                  'card-surface group w-full rounded-xl border p-3 text-left transition-all hover:bg-white/3 @2xl:px-4',
                  t.boost?.golden
                    ? 'border-amber-300/55 hover:border-amber-300/80'
                    : t.boost
                      ? 'border-amber-400/30 hover:border-amber-300/50'
                      : 'border-white/8 hover:border-[#8FA83F]/30'
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TokenGlyph src={t.image} ticker={t.ticker} size="md" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                      {t.ticker}
                      {t.verified && <OfficialBadge title={copy.tokens.officialTitle} />}
                      {t.isRug && <span className="rounded bg-[#ff4d5e]/15 px-1 py-px text-[9px] font-black text-[#ff8080]">RUG</span>}
                      {t.boost && <BoostCounter boost={t.boost} size="xs" />}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.name} · {timeAgo(t.launchedAt)}
                    </p>
                  </div>
                </div>
                <div className="hidden @2xl:block">
                  <NetworkBadge network={t.network} />
                </div>
                <p className="hidden text-right text-xs tabular-nums text-muted-foreground @[52rem]:block">{fmtPrice(t.price)}</p>
                <div className="min-w-0 text-right">
                  <p className="text-sm font-bold tabular-nums">{fmtMc(t.mc)}</p>
                  <div className="ml-auto mt-1 hidden h-1 w-full overflow-hidden rounded-full bg-[#8FA83F]/8 @2xl:block">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#8FA83F]/40 to-[#8FA83F]" style={{ width: `${Math.max((t.mc / maxMc) * 100, 4)}%` }} />
                  </div>
                </div>
                <p className={cn('text-right text-[13px] font-bold tabular-nums', t.change24h >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
                  {fmtPct(t.change24h)}
                </p>
                <p className="hidden text-right text-xs tabular-nums text-muted-foreground @2xl:block" title={t.holders > 0 ? undefined : copy.tokens.noHolders}>
                  {t.holders > 0 ? fmtNum(t.holders) : '—'}
                </p>
                <p className="hidden text-right text-xs tabular-nums text-muted-foreground @[52rem]:block">{fmtMc(t.volume24h)}</p>
                <div className="hidden min-w-0 items-center gap-1.5 pl-2 @2xl:flex">
                  {t.dev ? (
                    <>
                      <UserAvatar name={t.dev.name} src={t.dev.avatar} size="xs" verified={t.dev.walletVerified} official={t.dev.verified} ring={false} />
                      <span className="truncate text-[11px] text-muted-foreground">@{t.dev.handle}</span>
                    </>
                  ) : (
                    // Lo publicó un scout y nadie lo ha reclamado todavía
                    <span className="truncate text-[11px] text-muted-foreground/70" title={copy.tokens.unverifiedDev}>
                      {copy.tokens.unverified}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="hidden items-center gap-0.5 rounded-md bg-[#8FA83F]/8 px-1.5 py-0.5 text-[10px] font-bold text-primary group-hover:bg-[#8FA83F]/15 @2xl:inline-flex">
                    <MessageSquare className="h-3 w-3" aria-hidden /> {t.postsCount}
                  </span>
                  <QuickBuyButton contract={t.contract} network={t.network} ticker={t.ticker} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
