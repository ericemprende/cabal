'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Keypair, VersionedTransaction } from '@solana/web3.js'
import { Loader2, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useWalletPicker } from '@/components/cabal/wallet-picker'
import { jsonFetch } from '@/lib/api-client'
import { isUserRejection, solanaSignAndSend, solanaSignTransactions } from '@/lib/wallets'

/**
 * /admin → Comisiones → Cabal Launch: crear la configuración del launchpad
 * propio (una vez) y reclamar la parte de Cabal de cada token. Todo se firma
 * con Phantom: la clave de la wallet de Cabal nunca pasa por el servidor.
 */

type CabalLaunchState = {
  config: string | null
  feeClaimer: string
  terms: {
    tradingFeeBps: number
    creatorTradingFeePercentage: number
    initialMarketCapSol: number
    migrationMarketCapSol: number
    creatorLockedLiquidityPercentage: number
    partnerLockedLiquidityPercentage: number
  }
  tokens: { mint: string; name: string; symbol: string; image: string; partnerSol: number }[]
}

const b64 = (tx: VersionedTransaction) => Buffer.from(tx.serialize()).toString('base64')
const fromB64 = (s: string) => VersionedTransaction.deserialize(Buffer.from(s, 'base64'))

export function AdminCabalLaunch({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient()
  const q = useQuery<CabalLaunchState>({
    queryKey: ['admin', 'cabal-launch'],
    queryFn: () => jsonFetch('/api/admin/cabal-launch'),
    enabled,
  })
  const { requestWallet, picker } = useWalletPicker('solana')
  const [busy, setBusy] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'cabal-launch'] })

  const post = <T,>(body: unknown) => jsonFetch<T>('/api/admin/cabal-launch', { method: 'POST', body: JSON.stringify(body) })

  const createConfig = async () => {
    const payer = await requestWallet()
    if (!payer) return
    setBusy('config')
    try {
      const configKp = Keypair.generate()
      const config = configKp.publicKey.toBase58()
      const { tx } = await post<{ tx: string }>({ step: 'prepare', payer, config })
      const [signed] = await solanaSignTransactions([fromB64(tx)])
      signed.sign([configKp])
      await post({ step: 'save', config, tx: b64(signed) })
      toast.success('Cabal Launch configurado: ya se puede lanzar')
      refresh()
    } catch (e) {
      if (!isUserRejection(e)) toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const claim = async (mint: string) => {
    const wallet = await requestWallet()
    if (!wallet) return
    if (q.data && wallet !== q.data.feeClaimer) {
      toast.error('Conecta la wallet que cobra', { description: q.data.feeClaimer })
      return
    }
    setBusy(mint)
    try {
      const { tx } = await post<{ tx: string }>({ step: 'claim', mint })
      await solanaSignAndSend(fromB64(tx))
      toast.success('Comisiones de Cabal reclamadas')
      refresh()
    } catch (e) {
      if (!isUserRejection(e)) toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!q.data) return <Skeleton className="h-32 w-full" />
  const { config, terms, tokens, feeClaimer } = q.data
  const creatorShare = (terms.tradingFeeBps / 100) * 0.8 * (terms.creatorTradingFeePercentage / 100)
  const cabalShare = (terms.tradingFeeBps / 100) * 0.8 - creatorShare
  const pending = tokens.reduce((a, t) => a + t.partnerSol, 0)

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.04] p-3.5">
      <div className="mb-1 flex items-center gap-2">
        <Rocket className="h-5 w-5 text-amber-300" aria-hidden />
        <span className="font-bold">Cabal Launch (Meteora)</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            config ? 'bg-primary/15 text-primary' : 'bg-amber-400/15 text-amber-300'
          }`}
        >
          {config ? 'Activo' : 'Sin configurar'}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {terms.tradingFeeBps / 100} % por operación: Meteora 20 % · dev {creatorShare.toFixed(2)} % · Cabal{' '}
        {cabalShare.toFixed(2)} %. Curva de ~{terms.initialMarketCapSol} a ~{terms.migrationMarketCapSol} SOL de
        capitalización; al graduarse, liquidez bloqueada {terms.creatorLockedLiquidityPercentage}/
        {terms.partnerLockedLiquidityPercentage} dev/Cabal. Cobra: <span className="font-mono">{feeClaimer.slice(0, 6)}…</span>
      </p>

      {!config ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-amber-200/90">
            Se crea una sola vez y queda fija en la red. Firma con Phantom (cualquier wallet con ~0,05 SOL paga el
            alquiler); la parte de Cabal irá siempre a la wallet de arriba.
          </p>
          <Button onClick={() => void createConfig()} disabled={busy !== null} className="bg-amber-400 font-bold text-black hover:bg-amber-300">
            {busy === 'config' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Crear configuración de Cabal Launch
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-xs">
            Pendiente de reclamar: <span className="font-bold text-amber-300">{pending.toFixed(4)} SOL</span>
            <span className="text-muted-foreground"> · firma con la wallet que cobra</span>
          </p>
          {tokens.length === 0 && <p className="text-[11px] text-muted-foreground">Todavía no hay tokens lanzados en Cabal Launch.</p>}
          <ul className="space-y-1.5">
            {tokens.map((t) => (
              <li key={t.mint} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.image} alt="" className="h-7 w-7 rounded-md object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {t.name} <span className="text-muted-foreground">${t.symbol}</span>
                </span>
                <span className="text-xs tabular-nums">{t.partnerSol.toFixed(4)} SOL</span>
                <Button size="sm" variant="secondary" disabled={t.partnerSol <= 0 || busy !== null} onClick={() => void claim(t.mint)}>
                  {busy === t.mint ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Reclamar'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {picker}
    </div>
  )
}
