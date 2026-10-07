'use client'

import { useState } from 'react'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { ExternalLink, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBuildBuy, useBuildBuyEvm, useBuildSell, useConfirmSwap, useConfirmSwapEvm, useSwapConfig, useSwapConfigEvm, useTokenBalance } from '@/lib/api-client'
import { ensureEvmChain, EVM_EXPLORER, isEvmNetwork, signAndSendEvmBuy, type EvmNetwork } from '@/lib/evm-wallet'
import { disconnectWallet, isMwaConnected, isUserRejection, solanaSignAndSend } from '@/lib/wallets'
import { useConnectedAddress, useWalletPicker } from '@/components/cabal/wallet-picker'

/**
 * Panel de trading propio, al estilo fomo: pestañas Compra/Venta. Comprar usa
 * un monto en dólares con atajos; vender usa un porcentaje del saldo que
 * tiene la wallet conectada de este token.
 *
 * Cabal solo cotiza y arma la(s) transacción(es) (POST /api/swap/build o
 * /api/swap/sell); quien opera las firma con su propia wallet (Phantom,
 * Solflare, MetaMask… la que elija en el selector) y las
 * manda ella misma a la red — Cabal nunca ve ni toca una clave privada.
 *
 * La primerísima vez que Cabal entrega un mint dado (comprándolo, o
 * vendiéndolo a cambio de SOL), hace falta firmar dos transacciones en vez de
 * una: la primera crea la cuenta donde cae la comisión de ESE mint (nadie
 * generó una salida en él todavía, así que no existe); las siguientes
 * operaciones que entreguen ese mismo mint ya solo firman el swap.
 */

const PRESETS_USD = [10, 25, 50, 100]
const PRESETS_PCT = [25, 50, 75, 100]

/**
 * "0.37% ($0.05)" o, si el monto cae en el umbral chiquito configurado, la
 * comisión mínima. El monto en $ solo se muestra cuando amountUsd es un
 * número real (compras): en ventas no hay forma de saber cuánto vale en $ el
 * % del saldo sin conocer el precio, así que ahí solo se ve el %.
 */
function feeLabel(fee: { feeBps: number; smallTradeUsd: number; smallTradeFeeBps: number } | null | undefined, amountUsd: number): string | null {
  if (!fee) return null
  const bps = fee.smallTradeUsd > 0 && amountUsd > 0 && amountUsd < fee.smallTradeUsd ? fee.smallTradeFeeBps : fee.feeBps
  const pct = (bps / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return `${pct}%`
  const feeUsd = (amountUsd * bps) / 10000
  return `${pct}% ($${feeUsd.toFixed(feeUsd < 1 ? 2 : 0)})`
}

// Verde de las velas del gráfico (Birdeye), en vez del verde oliva del theme
const BUY_GREEN = '#0ECB81'
const BUY_GREEN_HOVER = '#12e08f'

export function TradePanel({
  contract,
  network,
  ticker,
  className,
  autoFocus = true,
}: {
  contract: string
  network: string
  ticker: string
  className?: string
  /** false donde el panel aparece mientras se escribe en otro campo (p. ej. el buscador) */
  autoFocus?: boolean
}) {
  const isEvm = isEvmNetwork(network)
  const { data: solConfig } = useSwapConfig()
  const { data: evmConfig } = useSwapConfigEvm(isEvm ? network : 'solana')
  const config = isEvm ? evmConfig : solConfig
  const build = useBuildBuy()
  const buildEvm = useBuildBuyEvm()
  const sell = useBuildSell()
  const confirm = useConfirmSwap()
  const confirmEvm = useConfirmSwapEvm()
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('') // USD (comprar) o % del saldo (vender)
  const family = isEvm ? 'evm' : 'solana'
  const pubkey = useConnectedAddress(family)
  const { requestWallet, picker } = useWalletPicker(family)
  const [busy, setBusy] = useState(false)
  const { data: balance, refetch: refetchBalance } = useTokenBalance(tab === 'sell' ? pubkey : null, tab === 'sell' ? contract : null)
  // La wallet conectada no tiene este token: se avisa antes de intentar vender
  // (antes la venta fallaba en el servidor con un error genérico)
  const noBalance = tab === 'sell' && !!pubkey && !!balance && !(balance.uiAmount > 0)

  if ((network !== 'solana' && !isEvm) || !config?.enabled) return null

  // Abre el selector de wallets si todavía no hay una conectada en esta página
  const connect = (): Promise<string | null> => requestWallet()

  // Con Mobile Wallet Adapter cada firma necesita su propio toque (ver isMwaConnected)
  const mwaNeedsTap = (verb: string): boolean => {
    if (!isMwaConnected()) return false
    toast.success('Wallet lista', { description: `Toca ${verb} otra vez para firmar en tu wallet.` })
    return true
  }

  const buyEvmNow = async (pk: string) => {
    const usd = Number(amount)
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

      toast.success('Compra enviada', {
        description: `$${usd} en $${ticker}`,
        action: { label: 'Ver ↗', onClick: () => window.open(`${EVM_EXPLORER[network as EvmNetwork]}/tx/${txHash}`, '_blank') },
      })
      setAmount('')
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      if (!isUserRejection(e)) {
        toast.error('No se pudo completar la compra', { description: msg.slice(0, 140) || 'Inténtalo de nuevo' })
      }
    } finally {
      setBusy(false)
    }
  }

  const buy = async () => {
    const usd = Number(amount)
    if (!(usd > 0)) return
    const pk = pubkey ?? (await connect())
    if (!pk) return
    if (!pubkey && !isEvm && mwaNeedsTap('Comprar')) return

    if (isEvm) {
      await buyEvmNow(pk)
      return
    }

    setBusy(true)
    try {
      const res = await build.mutateAsync({ outputMint: contract, amountUsd: usd, userPublicKey: pk })

      // Cuenta de comisión del token, solo si nadie lo compró antes por Cabal
      if (res.createFeeAccountTx) {
        const setupTx = Transaction.from(Buffer.from(res.createFeeAccountTx.base64, 'base64'))
        await solanaSignAndSend(setupTx)
        if (mwaNeedsTap('Comprar')) return
      }

      const swapTx = VersionedTransaction.deserialize(Buffer.from(res.swapTransaction.base64, 'base64'))
      const signature = await solanaSignAndSend(swapTx)
      if (res.intentId) confirm.mutate({ intentId: res.intentId, signature })

      toast.success('Compra enviada', {
        description: `$${usd} en $${ticker}`,
        action: { label: 'Ver ↗', onClick: () => window.open(`https://solscan.io/tx/${signature}`, '_blank') },
      })
      setAmount('')
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      if (!isUserRejection(e)) {
        toast.error('No se pudo completar la compra', { description: msg.slice(0, 140) || 'Inténtalo de nuevo' })
      }
    } finally {
      setBusy(false)
    }
  }

  const sellNow = async () => {
    const pct = Number(amount)
    if (!(pct > 0 && pct <= 100)) return
    const pk = pubkey ?? (await connect())
    if (!pk) return
    if (!pubkey && mwaNeedsTap('Vender')) return
    setBusy(true)
    try {
      const res = await sell.mutateAsync({ inputMint: contract, percent: pct, userPublicKey: pk })

      // Cuenta de comisión en SOL, solo si nadie la generó todavía por Cabal
      if (res.createFeeAccountTx) {
        const setupTx = Transaction.from(Buffer.from(res.createFeeAccountTx.base64, 'base64'))
        await solanaSignAndSend(setupTx)
        if (mwaNeedsTap('Vender')) return
      }

      const swapTx = VersionedTransaction.deserialize(Buffer.from(res.swapTransaction.base64, 'base64'))
      const signature = await solanaSignAndSend(swapTx)
      if (res.intentId) confirm.mutate({ intentId: res.intentId, signature })

      toast.success('Venta enviada', {
        description: `${pct}% de $${ticker}`,
        action: { label: 'Ver ↗', onClick: () => window.open(`https://solscan.io/tx/${signature}`, '_blank') },
      })
      setAmount('')
      // El saldo cambia en unos segundos: se relee para la siguiente venta
      setTimeout(() => void refetchBalance(), 4000)
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      if (!isUserRejection(e)) {
        toast.error('No se pudo completar la venta', { description: msg.slice(0, 140) || 'Inténtalo de nuevo' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('w-full shrink-0 rounded-xl border border-white/10 bg-[#0a0b08] p-3', className)}>
      {picker}
      {/* En redes EVM solo hay compra todavía (no hay venta integrada), así que no tiene sentido mostrar pestañas */}
      {!isEvm && (
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-[#121410] p-1">
          <button
            onClick={() => {
              setTab('buy')
              setAmount('')
            }}
            style={tab === 'buy' ? { backgroundColor: BUY_GREEN } : undefined}
            className={cn(
              'rounded-md py-1.5 text-xs font-bold transition-colors',
              tab === 'buy' ? 'text-black' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Compra
          </button>
          <button
            onClick={() => {
              setTab('sell')
              setAmount('')
            }}
            className={cn(
              'rounded-md py-1.5 text-xs font-bold transition-colors',
              tab === 'sell' ? 'bg-[#ff5c5c] text-white' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Venta
          </button>
        </div>
      )}

      {(isEvm || tab === 'buy') ? (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#121410] px-3 py-2.5">
            <span className="text-lg font-bold text-muted-foreground">$</span>
            <input
              autoFocus={autoFocus}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              aria-label={`Monto en dólares a comprar de ${ticker}`}
              className="w-full bg-transparent text-xl font-bold text-foreground outline-none"
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
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
                  'rounded-lg border py-1.5 text-xs font-bold transition-colors',
                  amount === String(p) ? '' : 'border-white/10 text-muted-foreground hover:text-foreground'
                )}
              >
                ${p}
              </button>
            ))}
          </div>
          {config.fee && (
            <p className="text-center text-[11px] text-muted-foreground">
              Comisión Cabal: <span className="font-bold text-foreground/80">{feeLabel(config.fee, Number(amount) || 0)}</span>
            </p>
          )}
          <Button
            onClick={buy}
            disabled={busy || !(Number(amount) > 0)}
            style={{ backgroundColor: BUY_GREEN }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = BUY_GREEN_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BUY_GREEN)}
            className="w-full gap-2 font-bold text-black"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Zap className="h-4 w-4" aria-hidden />}
            {pubkey ? `Comprar $${ticker}` : 'Conectar y comprar'}
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {pubkey && !noBalance && (
            <p className="text-center text-[11px] text-muted-foreground">
              Tienes {balance ? balance.uiAmount.toLocaleString('es', { maximumFractionDigits: 2 }) : '…'} ${ticker}
            </p>
          )}
          {noBalance && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-center text-[11px] leading-snug text-amber-200">
              La wallet <span className="font-mono">{pubkey.slice(0, 4)}…{pubkey.slice(-4)}</span> no tiene ${ticker}. Si lo
              tienes en otra cuenta, cámbiala en tu wallet (Phantom, Solflare…) o pulsa &quot;Cambiar wallet&quot;.
            </p>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#121410] px-3 py-2.5">
            <input
              autoFocus={autoFocus}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, '').slice(0, 3))}
              placeholder="0"
              aria-label={`Porcentaje del saldo a vender de ${ticker}`}
              className="w-full bg-transparent text-xl font-bold text-foreground outline-none"
            />
            <span className="text-lg font-bold text-muted-foreground">%</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS_PCT.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className={cn(
                  'rounded-lg border py-1.5 text-xs font-bold transition-colors',
                  amount === String(p)
                    ? 'border-[#ff5c5c]/50 bg-[#ff5c5c]/10 text-[#ff8080]'
                    : 'border-white/10 text-muted-foreground hover:border-[#ff5c5c]/30 hover:text-[#ff8080]'
                )}
              >
                {p === 100 ? 'Todo' : `${p}%`}
              </button>
            ))}
          </div>
          {config.fee && (
            <p className="text-center text-[11px] text-muted-foreground">
              Comisión Cabal: <span className="font-bold text-foreground/80">{feeLabel(config.fee, Infinity)}</span>
              {config.fee.smallTradeUsd > 0 && ' (menos en operaciones chiquitas)'}
            </p>
          )}
          <Button
            onClick={sellNow}
            disabled={busy || noBalance || !(Number(amount) > 0)}
            className="w-full gap-2 bg-[#ff5c5c] font-bold text-white hover:bg-[#ff7373]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Zap className="h-4 w-4" aria-hidden />}
            {pubkey ? `Vender $${ticker}` : 'Conectar y vender'}
          </Button>
        </div>
      )}

      {pubkey && (
        <p className="mt-2.5 text-center text-[10px] text-muted-foreground">
          <span className="font-mono">{pubkey.slice(0, 4)}…{pubkey.slice(-4)}</span>
          {' · '}
          <button
            onClick={() => {
              // Si una firma se quedó colgada, cambiar de wallet también libera el botón
              setBusy(false)
              disconnectWallet(family)
              void requestWallet()
            }}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Cambiar wallet
          </button>
        </p>
      )}
      {config.fee?.note && <p className="mt-2.5 text-center text-[10px] leading-relaxed text-muted-foreground/80">{config.fee.note}</p>}

      <a
        href={isEvm ? `${EVM_EXPLORER[network as EvmNetwork]}/token/${contract}` : `https://solscan.io/token/${contract}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
      >
        Ver token en {isEvm ? 'el explorador' : 'Solscan'} <ExternalLink className="h-2.5 w-2.5" aria-hidden />
      </a>
    </div>
  )
}
