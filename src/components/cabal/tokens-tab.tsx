'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { EmojiAvatar, NetworkBadge } from '@/components/cabal/shared'
import { fmtMc, fmtNum, fmtPct, fmtPrice, networkMeta, timeAgo } from '@/lib/cabal'
import { useTokens } from '@/lib/api-client'
import { useUI } from '@/lib/store'

const SORTS = [
  { key: 'trending', label: '🔥 Tendencia' },
  { key: 'new', label: '🆕 Nuevos' },
  { key: 'winners', label: '📈 Ganadores' },
  { key: 'losers', label: '📉 Perdedores' },
  { key: 'risk', label: '⚠️ Riesgo' },
] as const

const NETWORK_FILTERS = ['all', 'solana', 'base', 'ethereum', 'bsc', 'tron'] as const

export function TokensTab() {
  const [sort, setSort] = useState<string>('trending')
  const [network, setNetwork] = useState<string>('all')
  const { data: tokens, isLoading } = useTokens(sort, network)
  const { openToken } = useUI()

  const maxMc = useMemo(() => Math.max(...(tokens ?? []).map((t) => t.mc), 1), [tokens])

  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
              sort === s.key
                ? 'border-[#00ff88]/50 bg-[#00ff88]/10 text-primary neon-shadow'
                : 'border-[#00ff88]/12 bg-[#0b120d] text-muted-foreground hover:border-[#00ff88]/30 hover:text-foreground'
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-[#00ff88]/15" />
        {NETWORK_FILTERS.map((n) => (
          <button
            key={n}
            onClick={() => setNetwork(n)}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition-all',
              network === n ? 'border-[#00ff88]/50 bg-[#00ff88]/10 text-primary' : 'border-[#00ff88]/12 text-muted-foreground'
            )}
          >
            {n === 'all' ? '🌐' : networkMeta(n).short}
          </button>
        ))}
      </div>

      {/* Table header (desktop) */}
      <div className="hidden items-center gap-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:flex">
        <span className="w-56">Token</span>
        <span className="w-20">Red</span>
        <span className="w-20 text-right">Precio</span>
        <span className="w-24 text-right">Market Cap</span>
        <span className="w-20 text-right">24h</span>
        <span className="w-16 text-right">Holders</span>
        <span className="w-20 text-right">Vol 24h</span>
        <span className="flex-1 text-right">Dev</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-[64px] animate-pulse rounded-xl border border-[#00ff88]/8 bg-[#0b120d]" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {(tokens ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => openToken(t.id)}
              className="card-surface group flex w-full items-center gap-3 rounded-xl border border-[#00ff88]/8 p-3 text-left transition-all hover:border-[#00ff88]/30 hover:bg-[#00ff88]/3 md:gap-3 md:px-4"
            >
              <EmojiAvatar emoji={t.emoji} size="md" />
              <div className="w-40 min-w-0 flex-1 md:w-56 md:flex-none">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                  {t.ticker}
                  {t.isRug && <span className="rounded bg-[#ff4d5e]/15 px-1 py-px text-[9px] font-black text-[#ff8080]">RUG</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.name} · {timeAgo(t.launchedAt)}
                </p>
              </div>
              <div className="hidden md:block md:w-20">
                <NetworkBadge network={t.network} />
              </div>
              <div className="hidden text-right md:block md:w-20">
                <p className="text-xs text-muted-foreground">{fmtPrice(t.price)}</p>
              </div>
              <div className="text-right md:w-24">
                <p className="text-sm font-bold tabular-nums">{fmtMc(t.mc)}</p>
                <div className="mt-1 hidden h-1 w-24 overflow-hidden rounded-full bg-[#00ff88]/8 md:block">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#00ff88]/40 to-[#00ff88]" style={{ width: `${Math.max((t.mc / maxMc) * 100, 4)}%` }} />
                </div>
              </div>
              <p className={cn('w-14 text-right text-[13px] font-bold tabular-nums md:w-20', t.change24h >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
                {fmtPct(t.change24h)}
              </p>
              <p className="hidden text-right text-xs text-muted-foreground md:block md:w-16">{fmtNum(t.holders)}</p>
              <p className="hidden text-right text-xs text-muted-foreground md:block md:w-20">{fmtMc(t.volume24h)}</p>
              <div className="ml-auto flex items-center gap-1.5 md:w-32 md:justify-end">
                <EmojiAvatar emoji={t.dev.avatar} size="xs" verified={t.dev.walletVerified} ring={false} />
                <span className="hidden truncate text-[11px] text-muted-foreground lg:block">@{t.dev.handle}</span>
                <span className="rounded-md bg-[#00ff88]/8 px-1.5 py-0.5 text-[10px] font-bold text-primary group-hover:bg-[#00ff88]/15">
                  💬 {t.postsCount}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
