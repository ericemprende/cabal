'use client'

import { ExternalLink, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Redes soportadas por el TV widget de Birdeye (tron NO soportado)
const BIRDEYE_CHAINS: Record<string, string> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  bsc: 'bsc',
}

// Slugs de GMGN por red (sin tron)
const GMGN_SLUGS: Record<string, string> = {
  solana: 'sol',
  ethereum: 'eth',
  base: 'base',
  bsc: 'bsc',
}

// Slugs de DexScreener por red (todas, incluida tron)
const DEXSCREENER_SLUGS: Record<string, string> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  bsc: 'bsc',
  tron: 'tron',
}

export interface TradeLink {
  label: string
  url: string
  primary?: boolean
}

/**
 * Links externos para tradear el token según su red.
 * El recomendado (primary) va primero: Axiom Pro en solana,
 * GMGN en ethereum/base/bsc y DEXScreener en tron.
 */
export function tradeLinks(network: string, contract: string): TradeLink[] {
  if (!contract) return []
  const links: TradeLink[] = []

  if (network === 'solana') {
    links.push({ label: 'Axiom Pro', url: `https://axiom.trade/meme/${contract}`, primary: true })
  }

  const gmgn = GMGN_SLUGS[network]
  if (gmgn) {
    links.push({ label: 'GMGN', url: `https://gmgn.ai/${gmgn}/token/${contract}`, primary: network !== 'solana' })
  }

  const birdeye = BIRDEYE_CHAINS[network]
  if (birdeye) {
    links.push({ label: 'Birdeye', url: `https://birdeye.so/token/${contract}?chain=${birdeye}` })
  }

  const dex = DEXSCREENER_SLUGS[network]
  if (dex) {
    links.push({ label: 'DEXScreener', url: `https://dexscreener.com/${dex}/${contract}`, primary: network === 'tron' })
  }

  return links
}

/**
 * Gráfico de trading en vivo embebido (estilo GMGN / Axiom Pro).
 * Fuente principal: TV widget de Birdeye; en tron usa el embed de DexScreener.
 * Si no hay contrato o la red no tiene soporte, muestra un estado elegante
 * con acceso a las plataformas externas.
 */
export function LiveChart({ network, contract, height = 320 }: { network: string; contract: string; height?: number }) {
  const birdeyeChain = BIRDEYE_CHAINS[network]
  const dexSlug = DEXSCREENER_SLUGS[network]

  const birdeyeSrc = birdeyeChain && contract ? `https://birdeye.so/tv-widget/${contract}?chain=${birdeyeChain}` : null
  const dexSrc = dexSlug && contract ? `https://dexscreener.com/${dexSlug}/${contract}?embed=1&theme=dark&info=0&trades=0` : null
  // Birdeye no soporta tron bien: usamos DexScreener como fuente en esa red
  const src = network === 'tron' ? dexSrc : birdeyeSrc

  if (!src) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] px-4 text-center"
        style={{ height }}
      >
        <WifiOff className="h-5 w-5 text-muted-foreground/60" aria-hidden />
        <div>
          <p className="text-sm font-bold text-foreground/90">Gráfico en vivo no disponible para esta red</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Sigue el token en las plataformas externas</p>
        </div>
        <ExternalLinksRow network={network} contract={contract} className="justify-center" />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl bg-[#0a0b08]">
      <iframe
        src={src}
        className="w-full rounded-xl border border-white/10"
        style={{ height }}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        allow="clipboard-write"
        title="Gráfico en vivo"
      />
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="live-dot-red h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff4d5e]" aria-hidden />
        <p className="text-[10px] text-muted-foreground">Gráfico en vivo · datos on-chain</p>
      </div>
    </div>
  )
}

/** Fila reutilizable de botones para tradear en plataformas externas */
export function ExternalLinksRow({ network, contract, className }: { network: string; contract: string; className?: string }) {
  const links = tradeLinks(network, contract)
  if (links.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {links.map((link) => (
        <Button
          key={link.url}
          variant="outline"
          asChild
          className={cn(
            'h-8 gap-1.5 rounded-lg border-white/10 px-2.5 text-[11px] font-bold text-muted-foreground hover:bg-transparent hover:text-primary',
            link.primary && 'border-primary/40 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/15 hover:text-primary'
          )}
        >
          <a href={link.url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3 w-3" aria-hidden />
            {link.label}
          </a>
        </Button>
      ))}
    </div>
  )
}
