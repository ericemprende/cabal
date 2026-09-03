'use client'

import { useTokens } from '@/lib/api-client'
import { fmtMc, fmtPct, networkMeta } from '@/lib/cabal'
import { cn } from '@/lib/utils'

export function Ticker() {
  const { data: tokens } = useTokens('trending', 'all')
  const items = (tokens ?? []).slice(0, 10)
  if (items.length === 0) return null
  const doubled = [...items, ...items]
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 hidden h-8 items-center overflow-hidden border-t border-white/10 bg-[#0d0e0a]/95 backdrop-blur-md md:flex" aria-hidden>
      <div className="animate-ticker flex w-max items-center gap-8 px-4">
        {doubled.map((t, i) => (
          <span key={`${t.id}-${i}`} className="flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap">
            <span className="text-foreground/90">{t.ticker}</span>
            <span className="text-muted-foreground">{networkMeta(t.network).short}</span>
            <span className="text-foreground/80">{fmtMc(t.mc)}</span>
            <span className={cn(t.change24h >= 0 ? 'text-primary' : 'text-[#ff8080]')}>{fmtPct(t.change24h)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
