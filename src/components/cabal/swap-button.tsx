'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSwapConfig } from '@/lib/api-client'

/**
 * Comprar sin salir de Cabal: Jupiter Terminal, cargado del CDN oficial de
 * Jupiter y ejecutado entero en el navegador de quien compra. Cabal nunca ve
 * la wallet ni firma nada — solo le dice al widget qué token abrir y a qué
 * cuenta de referido va la comisión (ver lib/swap.ts).
 *
 * Solo aplica a Solana: es la única red donde Cabal tiene esto integrado por
 * ahora. En el resto se sigue usando ExternalLinksRow (enlaces de afiliado).
 */

declare global {
  interface Window {
    Jupiter?: {
      init: (config: Record<string, unknown>) => void
      resume?: () => void
      close?: () => void
      _instance?: unknown
    }
  }
}

const SCRIPT_SRC = 'https://plugin.jup.ag/plugin-v1.js'
let scriptPromise: Promise<void> | null = null

/** Inyecta el script del plugin una sola vez por página, lo reutiliza si ya está. */
function loadJupiterScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No hay ventana'))
  if (window.Jupiter) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    const script = (existing as HTMLScriptElement) ?? document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Jupiter'))
    if (!existing) document.head.appendChild(script)
    else if (window.Jupiter) resolve() // ya había terminado de cargar
  })
  return scriptPromise
}

export function CabalSwapButton({
  contract,
  network,
  ticker,
  className,
}: {
  contract: string
  network: string
  ticker: string
  className?: string
}) {
  const { data: config } = useSwapConfig()
  const [loading, setLoading] = useState(false)
  const modalId = useRef(`jupiter-modal-${Math.random().toString(36).slice(2)}`)

  // Sin cerrar la instancia anterior, el segundo "Comprar" que se abre en la
  // sesión reutiliza el estado del primer token en vez del nuevo.
  useEffect(() => () => window.Jupiter?.close?.(), [])

  const open = useCallback(async () => {
    if (network !== 'solana' || !config?.enabled) return
    setLoading(true)
    try {
      await loadJupiterScript()
      window.Jupiter?.close?.()
      window.Jupiter?.init({
        displayMode: 'modal',
        endpoint: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        formProps: {
          initialInputMint: config.solMint,
          initialOutputMint: contract,
          fixedOutputMint: true,
        },
        ...(config.fee && {
          platformFeeAndAccounts: { referralAccount: config.fee.referralAccount, feeBps: config.fee.feeBps },
        }),
      })
    } catch {
      // Silencioso a propósito: si el CDN de Jupiter no responde, el usuario
      // igual tiene los enlaces de afiliado justo al lado como alternativa.
    } finally {
      setLoading(false)
    }
  }, [config, contract, network])

  if (network !== 'solana' || !config?.enabled) return null

  return (
    <Button
      id={modalId.current}
      onClick={open}
      disabled={loading}
      className={cn(
        'h-8 gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-black text-primary-foreground hover:bg-[#8FA83F]',
        className
      )}
      aria-label={ticker ? `Comprar $${ticker} en Cabal` : 'Comprar en Cabal'}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" aria-hidden />}
      Comprar en Cabal
    </Button>
  )
}
