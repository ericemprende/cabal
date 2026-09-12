'use client'

import { useState } from 'react'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useBuildBuy, useConfirmSwap, useSwapConfig } from '@/lib/api-client'

/**
 * Botón compacto de "Comprar" para usar al lado de un token en una lista
 * (tabla de Tokens, tarjetas del feed, etc.), sin tener que abrir el detalle.
 * Es el mismo mecanismo que TradePanel (arma en el servidor, firma y manda
 * con la wallet de quien compra) mostrado en un popover chiquito.
 */

const PRESETS_USD = [10, 25, 50, 100]

/** "0.37%" o, si el monto cae en el umbral chiquito configurado, la comisión mínima. */
function feeLabel(fee: { feeBps: number; smallTradeUsd: number; smallTradeFeeBps: number } | null | undefined, amountUsd: number): string | null {
  if (!fee) return null
  const bps = fee.smallTradeUsd > 0 && amountUsd > 0 && amountUsd < fee.smallTradeUsd ? fee.smallTradeFeeBps : fee.feeBps
  const pct = (bps / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${pct}%`
}

type PhantomSolana = {
  connect: () => Promise<{ publicKey: { toString(): string } }>
  signAndSendTransaction: (tx: Transaction | VersionedTransaction) => Promise<{ signature: string }>
}

function phantomProvider(): PhantomSolana | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { phantom?: { solana?: PhantomSolana }; solana?: PhantomSolana & { isPhantom?: boolean } }
  return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null) ?? null
}

export function QuickBuyButton({ contract, network, ticker, className }: { contract: string; network: string; ticker: string; className?: string }) {
  const { data: config } = useSwapConfig()
  const build = useBuildBuy()
  const confirm = useConfirmSwap()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [pubkey, setPubkey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (network !== 'solana' || !config?.enabled) return null

  const buy = async () => {
    const usd = Number(amount)
    if (!(usd > 0)) return
    let pk = pubkey
    const p = phantomProvider()
    if (!p) {
      toast.error('Instala Phantom para comprar desde Cabal', { description: 'phantom.app' })
      return
    }
    if (!pk) {
      try {
        const res = await p.connect()
        pk = res.publicKey.toString()
        setPubkey(pk)
      } catch {
        return // el usuario canceló la conexión
      }
    }

    setBusy(true)
    try {
      const res = await build.mutateAsync({ outputMint: contract, amountUsd: usd, userPublicKey: pk })

      if (res.createFeeAccountTx) {
        const setupTx = Transaction.from(Buffer.from(res.createFeeAccountTx.base64, 'base64'))
        await p.signAndSendTransaction(setupTx)
      }

      const swapTx = VersionedTransaction.deserialize(Buffer.from(res.swapTransaction.base64, 'base64'))
      const { signature } = await p.signAndSendTransaction(swapTx)
      if (res.intentId) confirm.mutate({ intentId: res.intentId, signature })

      toast.success('Compra enviada', {
        description: `$${usd} en $${ticker}`,
        action: { label: 'Ver ↗', onClick: () => window.open(`https://solscan.io/tx/${signature}`, '_blank') },
      })
      setOpen(false)
      setAmount('')
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      if (!/user rejected/i.test(msg)) {
        toast.error('No se pudo completar la compra', { description: msg.slice(0, 140) || 'Inténtalo de nuevo' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          aria-label={`Comprar $${ticker}`}
          className={cn(
            'flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-black text-primary-foreground transition-colors hover:bg-[#8FA83F]',
            className
          )}
        >
          <Zap className="h-3 w-3" aria-hidden />
          Comprar
        </button>
      </PopoverTrigger>
      <PopoverContent
        onClick={(e) => e.stopPropagation()}
        align="end"
        className="w-64 border-white/10 bg-[#121410] p-3"
      >
        <p className="mb-2 text-xs font-bold text-foreground/90">Comprar ${ticker}</p>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2">
          <span className="text-base font-bold text-muted-foreground">$</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            aria-label={`Monto en dólares a comprar de ${ticker}`}
            className="w-full bg-transparent text-lg font-bold text-foreground outline-none"
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {PRESETS_USD.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className={cn(
                'rounded-lg border py-1.5 text-[11px] font-bold transition-colors',
                amount === String(p)
                  ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                  : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30 hover:text-primary'
              )}
            >
              ${p}
            </button>
          ))}
        </div>
        {config.fee && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Comisión Cabal: <span className="font-bold text-foreground/80">{feeLabel(config.fee, Number(amount) || 0)}</span>
          </p>
        )}
        <Button
          onClick={buy}
          disabled={busy || !(Number(amount) > 0)}
          className="mt-2.5 h-9 w-full gap-1.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Zap className="h-3.5 w-3.5" aria-hidden />}
          {pubkey ? `Comprar $${ticker}` : 'Conectar y comprar'}
        </Button>
        {config.fee?.note && <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground/80">{config.fee.note}</p>}
      </PopoverContent>
    </Popover>
  )
}
