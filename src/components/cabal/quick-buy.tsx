'use client'

import { useState } from 'react'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { useBuildBuy, useBuildBuyEvm, useConfirmSwap, useConfirmSwapEvm, useSwapConfig, useSwapConfigEvm } from '@/lib/api-client'
import { connectEvmWallet, ensureEvmChain, EVM_EXPLORER, evmProvider, isEvmNetwork, signAndSendEvmBuy, type EvmNetwork } from '@/lib/evm-wallet'

/**
 * Botón compacto de "Comprar" para usar al lado de un token en una lista
 * (tabla de Tokens, tarjetas del feed, etc.), sin tener que abrir el detalle.
 * Es el mismo mecanismo que TradePanel (arma en el servidor, firma y manda
 * con la wallet de quien compra) mostrado en un popover chiquito.
 */

const PRESETS_USD = [10, 25, 50, 100]

// Verde de las velas del gráfico (Birdeye), en vez del verde oliva del theme
const BUY_GREEN = '#0ECB81'
const BUY_GREEN_HOVER = '#12e08f'

/** "0.37% ($0.05)" o, si el monto cae en el umbral chiquito configurado, la comisión mínima. */
function feeLabel(fee: { feeBps: number; smallTradeUsd: number; smallTradeFeeBps: number } | null | undefined, amountUsd: number): string | null {
  if (!fee) return null
  const bps = fee.smallTradeUsd > 0 && amountUsd > 0 && amountUsd < fee.smallTradeUsd ? fee.smallTradeFeeBps : fee.feeBps
  const pct = (bps / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return `${pct}%`
  const feeUsd = (amountUsd * bps) / 10000
  return `${pct}% ($${feeUsd.toFixed(feeUsd < 1 ? 2 : 0)})`
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

export function QuickBuyButton({
  contract,
  network,
  ticker,
  className,
  iconOnly,
}: {
  contract: string
  network: string
  ticker: string
  className?: string
  /** Solo el rayo, sin el texto "Comprar" — para espacios chicos (p. ej. Actividad del Cabal). */
  iconOnly?: boolean
}) {
  const t = useT()
  const isEvm = isEvmNetwork(network)
  const { data: solConfig } = useSwapConfig()
  const { data: evmConfig } = useSwapConfigEvm(isEvm ? network : 'solana')
  const config = isEvm ? evmConfig : solConfig
  const build = useBuildBuy()
  const buildEvm = useBuildBuyEvm()
  const confirm = useConfirmSwap()
  const confirmEvm = useConfirmSwapEvm()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [pubkey, setPubkey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if ((network !== 'solana' && !isEvm) || !config?.enabled) return null

  const buy = async () => {
    const usd = Number(amount)
    if (!(usd > 0)) return

    if (isEvm) {
      let pk = pubkey
      if (!evmProvider()) {
        toast.error(t.buy.needMetamask, { description: 'metamask.io' })
        return
      }
      if (!pk) {
        pk = await connectEvmWallet()
        if (!pk) return // el usuario canceló la conexión
        setPubkey(pk)
      }

      setBusy(true)
      try {
        await ensureEvmChain(network as EvmNetwork)
        const res = await buildEvm.mutateAsync({ network, outputToken: contract, amountUsd: usd, userAddress: pk })
        const txHash = await signAndSendEvmBuy({
          network: network as EvmNetwork,
          from: pk,
          transaction: res.transaction,
          permit2Eip712: res.permit2Eip712,
        })
        if (res.intentId) confirmEvm.mutate({ intentId: res.intentId, network, txHash })

        toast.success(t.buy.sent, {
          description: `$${usd} en $${ticker}`,
          action: { label: t.buy.see, onClick: () => window.open(`${EVM_EXPLORER[network as EvmNetwork]}/tx/${txHash}`, '_blank') },
        })
        setOpen(false)
        setAmount('')
      } catch (e) {
        const msg = (e as Error)?.message ?? ''
        if (!/user rejected/i.test(msg)) {
          toast.error(t.buy.failed, { description: msg.slice(0, 140) || t.buy.tryAgain })
        }
      } finally {
        setBusy(false)
      }
      return
    }

    let pk = pubkey
    const p = phantomProvider()
    if (!p) {
      toast.error(t.buy.needPhantom, { description: 'phantom.app' })
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

      toast.success(t.buy.sent, {
        description: `$${usd} en $${ticker}`,
        action: { label: t.buy.see, onClick: () => window.open(`https://solscan.io/tx/${signature}`, '_blank') },
      })
      setOpen(false)
      setAmount('')
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      if (!/user rejected/i.test(msg)) {
        toast.error(t.buy.failed, { description: msg.slice(0, 140) || t.buy.tryAgain })
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
          aria-label={t.buy.buyAria(ticker)}
          style={{ backgroundColor: BUY_GREEN }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BUY_GREEN_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BUY_GREEN)}
          className={cn(
            'flex h-7 items-center gap-1 rounded-lg font-black text-black transition-colors',
            iconOnly ? 'w-7 justify-center' : 'px-2.5 text-[11px]',
            className
          )}
        >
          <Zap className="h-3 w-3" aria-hidden />
          {!iconOnly && t.buy.buy}
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
            aria-label={t.buy.amountAria(ticker)}
            className="w-full bg-transparent text-lg font-bold text-foreground outline-none"
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {PRESETS_USD.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              style={
                amount === String(p)
                  ? { borderColor: `${BUY_GREEN}80`, backgroundColor: `${BUY_GREEN}1a`, color: BUY_GREEN }
                  : undefined
              }
              className={cn(
                'rounded-lg border py-1.5 text-[11px] font-bold transition-colors',
                amount === String(p) ? '' : 'border-white/10 text-muted-foreground hover:text-foreground'
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
          style={{ backgroundColor: BUY_GREEN }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = BUY_GREEN_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BUY_GREEN)}
          className="mt-2.5 w-full gap-1.5 text-xs font-bold text-black"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Zap className="h-3.5 w-3.5" aria-hidden />}
          {pubkey ? t.buy.buyAria(ticker) : t.buy.connectAndBuy}
        </Button>
        {config.fee?.note && <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground/80">{config.fee.note}</p>}
      </PopoverContent>
    </Popover>
  )
}
