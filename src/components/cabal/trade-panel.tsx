'use client'

import { useState } from 'react'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { ExternalLink, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBuildBuy, useBuildSell, useSwapConfig, useTokenBalance } from '@/lib/api-client'

/**
 * Panel de trading propio, al estilo fomo: pestañas Compra/Venta. Comprar usa
 * un monto en dólares con atajos; vender usa un porcentaje del saldo que
 * tiene la wallet conectada de este token.
 *
 * Cabal solo cotiza y arma la(s) transacción(es) (POST /api/swap/build o
 * /api/swap/sell); quien opera las firma con su propia wallet (Phantom) y las
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

type PhantomSolana = {
  connect: () => Promise<{ publicKey: { toString(): string } }>
  signAndSendTransaction: (tx: Transaction | VersionedTransaction) => Promise<{ signature: string }>
}

function phantomProvider(): PhantomSolana | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { phantom?: { solana?: PhantomSolana }; solana?: PhantomSolana & { isPhantom?: boolean } }
  return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null) ?? null
}

export function TradePanel({
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
  const build = useBuildBuy()
  const sell = useBuildSell()
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [stage, setStage] = useState<'idle' | 'amount'>('idle')
  const [amount, setAmount] = useState('') // USD (comprar) o % del saldo (vender)
  const [pubkey, setPubkey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { data: balance } = useTokenBalance(tab === 'sell' ? pubkey : null, tab === 'sell' ? contract : null)

  if (network !== 'solana' || !config?.enabled) return null

  const connect = async (): Promise<string | null> => {
    const p = phantomProvider()
    if (!p) {
      toast.error('Instala Phantom para comprar desde Cabal', { description: 'phantom.app' })
      return null
    }
    try {
      const res = await p.connect()
      const pk = res.publicKey.toString()
      setPubkey(pk)
      return pk
    } catch {
      return null // el usuario canceló la conexión
    }
  }

  const buy = async () => {
    const usd = Number(amount)
    if (!(usd > 0)) return
    const pk = pubkey ?? (await connect())
    if (!pk) return
    const p = phantomProvider()
    if (!p) return

    setBusy(true)
    try {
      const res = await build.mutateAsync({ outputMint: contract, amountUsd: usd, userPublicKey: pk })

      // Cuenta de comisión del token, solo si nadie lo compró antes por Cabal
      if (res.createFeeAccountTx) {
        const setupTx = Transaction.from(Buffer.from(res.createFeeAccountTx.base64, 'base64'))
        await p.signAndSendTransaction(setupTx)
      }

      const swapTx = VersionedTransaction.deserialize(Buffer.from(res.swapTransaction.base64, 'base64'))
      const { signature } = await p.signAndSendTransaction(swapTx)

      toast.success('Compra enviada', {
        description: `$${usd} en $${ticker}`,
        action: { label: 'Ver ↗', onClick: () => window.open(`https://solscan.io/tx/${signature}`, '_blank') },
      })
      setStage('idle')
      setAmount('')
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      // Phantom no da un código estable para "el usuario canceló": se detecta por el texto
      if (!/user rejected/i.test(msg)) {
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
    const p = phantomProvider()
    if (!p) return

    setBusy(true)
    try {
      const res = await sell.mutateAsync({ inputMint: contract, percent: pct, userPublicKey: pk })

      // Cuenta de comisión en SOL, solo si nadie la generó todavía por Cabal
      if (res.createFeeAccountTx) {
        const setupTx = Transaction.from(Buffer.from(res.createFeeAccountTx.base64, 'base64'))
        await p.signAndSendTransaction(setupTx)
      }

      const swapTx = VersionedTransaction.deserialize(Buffer.from(res.swapTransaction.base64, 'base64'))
      const { signature } = await p.signAndSendTransaction(swapTx)

      toast.success('Venta enviada', {
        description: `${pct}% de $${ticker}`,
        action: { label: 'Ver ↗', onClick: () => window.open(`https://solscan.io/tx/${signature}`, '_blank') },
      })
      setStage('idle')
      setAmount('')
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      if (!/user rejected/i.test(msg)) {
        toast.error('No se pudo completar la venta', { description: msg.slice(0, 140) || 'Inténtalo de nuevo' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('w-full shrink-0 rounded-xl border border-white/10 bg-[#0a0b08] p-3', className)}>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-[#121410] p-1">
        <button
          onClick={() => {
            setTab('buy')
            setStage('idle')
            setAmount('')
          }}
          className={cn(
            'rounded-md py-1.5 text-xs font-bold transition-colors',
            tab === 'buy' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Compra
        </button>
        <button
          onClick={() => {
            setTab('sell')
            setStage('idle')
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

      {stage === 'idle' ? (
        <Button
          onClick={() => setStage('amount')}
          className={cn(
            'mt-3 h-10 w-full rounded-lg font-bold',
            tab === 'buy'
              ? 'bg-primary text-primary-foreground hover:bg-[#8FA83F]'
              : 'bg-[#ff5c5c] text-white hover:bg-[#ff7373]'
          )}
        >
          {tab === 'buy' ? 'Comprar' : 'Vender'}
        </Button>
      ) : tab === 'buy' ? (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#121410] px-3 py-2.5">
            <span className="text-lg font-bold text-muted-foreground">$</span>
            <input
              autoFocus
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
                className={cn(
                  'rounded-lg border py-1.5 text-xs font-bold transition-colors',
                  amount === String(p)
                    ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                    : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30 hover:text-primary'
                )}
              >
                ${p}
              </button>
            ))}
          </div>
          <Button
            onClick={buy}
            disabled={busy || !(Number(amount) > 0)}
            className="h-11 w-full gap-2 rounded-lg bg-primary font-bold text-primary-foreground hover:bg-[#8FA83F]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Zap className="h-4 w-4" aria-hidden />}
            {pubkey ? `Comprar $${ticker}` : 'Conectar y comprar'}
          </Button>
          <button onClick={() => setStage('idle')} className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground">
            Volver
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {pubkey && (
            <p className="text-center text-[11px] text-muted-foreground">
              Tienes {balance ? balance.uiAmount.toLocaleString('es', { maximumFractionDigits: 2 }) : '…'} ${ticker}
            </p>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#121410] px-3 py-2.5">
            <input
              autoFocus
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
          <Button
            onClick={sellNow}
            disabled={busy || !(Number(amount) > 0)}
            className="h-11 w-full gap-2 rounded-lg bg-[#ff5c5c] font-bold text-white hover:bg-[#ff7373]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Zap className="h-4 w-4" aria-hidden />}
            {pubkey ? `Vender $${ticker}` : 'Conectar y vender'}
          </Button>
          <button onClick={() => setStage('idle')} className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground">
            Volver
          </button>
        </div>
      )}

      <a
        href={`https://solscan.io/token/${contract}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
      >
        Ver token en Solscan <ExternalLink className="h-2.5 w-2.5" aria-hidden />
      </a>
    </div>
  )
}
