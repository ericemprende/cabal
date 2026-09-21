'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NetworkBadge, TokenGlyph } from '@/components/cabal/shared'
import { QuickBuyButton } from '@/components/cabal/quick-buy'
import { ExternalLinksRow, LiveChart } from '@/components/cabal/live-chart'
import { networkMeta } from '@/lib/cabal'

const SOLANA_CA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const EVM_CA = /^0x[a-fA-F0-9]{40}$/
const EVM_BUY_NETWORKS = ['base', 'ethereum', 'bsc', 'robinhood', 'arc'] as const

type Meta = { found: boolean; network: string; name: string; symbol: string; image: string }

/** ¿Lo pegado es un contrato (solana o EVM)? Lo usa también el buscador general. */
export function isContractAddress(value: string): boolean {
  const clean = value.trim()
  return SOLANA_CA.test(clean) || EVM_CA.test(clean)
}

/**
 * Pegar un contrato y comprarlo aunque el token no esté publicado en Cabal.
 * La red la detecta DexScreener/pump.fun; si un 0x no cotiza en ningún lado,
 * se elige la red a mano.
 */
export function ContractBuy() {
  const [ca, setCa] = useState('')

  const clean = ca.trim()
  const valid = isContractAddress(clean)

  return (
    <div className="space-y-2">
      <div className="card-surface flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2 focus-within:border-[#8FA83F]/40">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={ca}
          onChange={(e) => setCa(e.target.value)}
          placeholder="Pega un contrato (CA) para ver su gráfico y comprarlo"
          aria-label="Contrato del token"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none sm:text-xs placeholder:font-sans placeholder:text-muted-foreground"
        />
        {ca && (
          <button onClick={() => setCa('')} aria-label="Borrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {clean && !valid && <p className="px-1 text-[11px] text-[#ff8080]">Ese contrato no parece válido.</p>}

      {valid && <ContractResult ca={clean} />}
    </div>
  )
}

/**
 * Ficha de un token a partir de su contrato: nombre, red, botón de compra y el
 * gráfico en vivo. Sirve tanto para un token que no está en el Radar como para
 * uno que sí: es el mismo gráfico que se ve en el detalle.
 */
export function ContractResult({ ca, chartHeight = 320 }: { ca: string; chartHeight?: number }) {
  // Resultado de la búsqueda junto al CA que lo produjo, para no mostrar uno viejo
  const [lookup, setLookup] = useState<{ ca: string; meta: Meta | null } | null>(null)
  const [evmNetwork, setEvmNetwork] = useState<string>('base')

  const clean = ca.trim()
  const isSol = SOLANA_CA.test(clean)
  const isEvm = EVM_CA.test(clean)

  const loading = lookup?.ca !== clean
  const meta = lookup?.ca === clean ? lookup.meta : null

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tokens/lookup?ca=${encodeURIComponent(clean)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Meta | null) => {
        if (cancelled) return
        setLookup({ ca: clean, meta: m })
        if (m?.found && m.network && m.network !== 'solana') setEvmNetwork(m.network)
      })
      .catch(() => !cancelled && setLookup({ ca: clean, meta: null }))
    return () => {
      cancelled = true
    }
  }, [clean])

  if (loading) {
    return (
      <div className="card-surface flex items-center gap-2 rounded-xl border border-white/8 p-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Buscando el token…
      </div>
    )
  }

  const detected = meta?.found && meta.network ? meta.network : ''
  const network = isSol ? 'solana' : detected || evmNetwork
  const ticker = meta?.symbol || `${clean.slice(0, 4)}…${clean.slice(-4)}`
  // Sin red detectada de verdad, el gráfico apuntaría a una cadena elegida a
  // dedo y saldría vacío: solo se enseña cuando sabemos dónde cotiza.
  const showChart = !!detected || (isSol && meta?.found)

  return (
    <div className="space-y-2">
      <div className="card-surface flex flex-wrap items-center gap-3 rounded-xl border border-[#8FA83F]/25 p-3">
        <TokenGlyph src={meta?.image || undefined} ticker={meta?.symbol || '?'} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{meta?.found ? meta.symbol : 'Token no encontrado'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {meta?.found ? meta.name : 'No cotiza en DexScreener; la compra puede fallar si no tiene liquidez.'}
          </p>
        </div>
        {isEvm && !detected ? (
          <div className="flex gap-1">
            {EVM_BUY_NETWORKS.map((n) => (
              <button
                key={n}
                onClick={() => setEvmNetwork(n)}
                className={cn(
                  'rounded-full border px-2 py-1 text-[11px] font-bold',
                  evmNetwork === n ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground'
                )}
              >
                {networkMeta(n).short}
              </button>
            ))}
          </div>
        ) : (
          <NetworkBadge network={network} />
        )}
        <QuickBuyButton key={`${clean}-${network}`} contract={clean} network={network} ticker={ticker} />
      </div>

      {showChart && (
        <>
          <LiveChart network={network} contract={clean} height={chartHeight} />
          <ExternalLinksRow network={network} contract={clean} ticker={ticker} />
        </>
      )}
    </div>
  )
}
