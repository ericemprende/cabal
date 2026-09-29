'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { Keypair, VersionedTransaction } from '@solana/web3.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CabalWordmark } from '@/components/cabal/shared'
import { ImageDrop } from '@/components/cabal/image-drop'
import { useConnectedAddress, useWalletPicker } from '@/components/cabal/wallet-picker'
import { uploadImage } from '@/lib/api-client'
import { isUserRejection, solanaSignTransactions } from '@/lib/wallets'
import { useLang } from '@/lib/i18n/provider'

/**
 * /lanzar — crear un token en pump.fun sin salir de Cabal (SDK oficial).
 *
 * 1. El navegador genera la clave del token nuevo (nunca sale de aquí).
 * 2. /api/pump/prepare guarda el metadata y arma la transacción.
 * 3. Firma la wallet del creador y después la clave del token.
 * 4. /api/pump/confirm la manda a la red y publica el launch en el Radar.
 */

const TXT = {
  es: {
    back: 'Volver',
    title: 'Lanza tu token en pump.fun',
    lead: 'Se crea en pump.fun con tu wallet y sale publicado en el Radar de Cabal como launch tuyo. Tú firmas: Cabal nunca ve tus claves.',
    image: 'Imagen del token',
    imageHint: 'Cuadrada, PNG, JPG, WebP o GIF',
    name: 'Nombre',
    symbol: 'Ticker',
    description: 'Descripción',
    twitter: 'X (Twitter)',
    telegram: 'Telegram',
    website: 'Web',
    optional: 'opcional',
    buy: 'Compra inicial (SOL)',
    buyHint: 'Lo que compras tú al crearlo, en la misma transacción. 0 = no compras.',
    costs: 'pump.fun cobra su tarifa de creación y la red una pequeña comisión; tu wallet te muestra el total antes de firmar.',
    launch: 'Lanzar token',
    connect: 'Conectar wallet y lanzar',
    preparing: 'Preparando…',
    signing: 'Firma en tu wallet…',
    sending: 'Publicando en la red…',
    missing: 'Completa imagen, nombre y ticker',
    imageUp: 'Imagen subida',
    done: '¡Token lanzado!',
    viewPump: 'Ver en pump.fun',
    viewRadar: 'Ver en el Radar',
    another: 'Lanzar otro',
    fee: (sol: number) => `Incluye ${sol} SOL de comisión de Cabal.`,
  },
  en: {
    back: 'Back',
    title: 'Launch your token on pump.fun',
    lead: 'It is created on pump.fun with your wallet and published on the Cabal Radar as your launch. You sign: Cabal never sees your keys.',
    image: 'Token image',
    imageHint: 'Square, PNG, JPG, WebP or GIF',
    name: 'Name',
    symbol: 'Ticker',
    description: 'Description',
    twitter: 'X (Twitter)',
    telegram: 'Telegram',
    website: 'Website',
    optional: 'optional',
    buy: 'Initial buy (SOL)',
    buyHint: 'What you buy when creating it, in the same transaction. 0 = no buy.',
    costs: 'pump.fun charges its creation fee and the network a small fee; your wallet shows the total before you sign.',
    launch: 'Launch token',
    connect: 'Connect wallet and launch',
    preparing: 'Preparing…',
    signing: 'Sign in your wallet…',
    sending: 'Publishing on-chain…',
    missing: 'Fill in image, name and ticker',
    imageUp: 'Image uploaded',
    done: 'Token launched!',
    viewPump: 'View on pump.fun',
    viewRadar: 'View on the Radar',
    another: 'Launch another',
    fee: (sol: number) => `Includes a ${sol} SOL Cabal fee.`,
  },
}

const EMPTY = { name: '', symbol: '', description: '', image: '', twitter: '', telegram: '', website: '', buy: '0' }

type Step = 'idle' | 'preparing' | 'signing' | 'sending'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data as T
}

export default function LanzarPage() {
  const [lang] = useLang()
  const t = TXT[lang] ?? TXT.es
  const [form, setForm] = useState(EMPTY)
  const [step, setStep] = useState<Step>('idle')
  const [feeSol, setFeeSol] = useState(0)
  const [launched, setLaunched] = useState<{ mint: string } | null>(null)
  const pubkey = useConnectedAddress('solana')
  const { requestWallet, picker } = useWalletPicker('solana')

  // La comisión se enseña antes de firmar, no solo en la wallet
  useEffect(() => {
    fetch('/api/pump/fee')
      .then((r) => r.json())
      .then((d: { sol?: number }) => setFeeSol(d.sol ?? 0))
      .catch(() => {})
  }, [])

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const onImage = async (file: File) => {
    set('image', 'uploading')
    try {
      set('image', await uploadImage(file))
      toast.success(t.imageUp)
    } catch (e) {
      set('image', '')
      toast.error((e as Error).message)
    }
  }

  const launch = async () => {
    if (!form.image || form.image === 'uploading' || !form.name.trim() || !form.symbol.trim()) {
      toast.error(t.missing)
      return
    }
    const creator = await requestWallet()
    if (!creator) return

    const mintKp = Keypair.generate()
    const mint = mintKp.publicKey.toBase58()
    try {
      setStep('preparing')
      const prep = await postJson<{ txs: string[]; feeSol: number }>('/api/pump/prepare', {
        mint,
        creator,
        name: form.name,
        symbol: form.symbol,
        description: form.description,
        image: form.image,
        twitter: form.twitter,
        telegram: form.telegram,
        website: form.website,
        initialBuySol: Number(form.buy.replace(',', '.')) || 0,
      })
      setFeeSol(prep.feeSol)

      setStep('signing')
      // La wallet firma primero (todas de una vez); la clave del token, después
      // y solo la creación
      const signed = await solanaSignTransactions(prep.txs.map((b) => VersionedTransaction.deserialize(Buffer.from(b, 'base64'))))
      signed[0].sign([mintKp])

      setStep('sending')
      const res = await postJson<{ buyError: string | null }>('/api/pump/confirm', {
        mint,
        txs: signed.map((tx) => Buffer.from(tx.serialize()).toString('base64')),
      })
      setLaunched({ mint })
      toast.success(t.done)
      if (res.buyError) toast.warning(res.buyError)
    } catch (e) {
      if (!isUserRejection(e)) toast.error((e as Error).message)
    } finally {
      setStep('idle')
    }
  }

  const busy = step !== 'idle'
  const label = step === 'preparing' ? t.preparing : step === 'signing' ? t.signing : step === 'sending' ? t.sending : pubkey ? t.launch : t.connect

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0b08]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-3 px-3 sm:px-4">
          <Link
            href="/app"
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> <span className="hidden min-[400px]:inline">{t.back}</span>
          </Link>
          <Link href="/app" className="ml-1 flex min-w-0 items-center transition-opacity hover:opacity-80" aria-label="Cabal">
            <CabalWordmark />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-2xl flex-1 px-3 pb-16 pt-6 sm:px-4 sm:pt-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Rocket className="h-6 w-6 text-primary" aria-hidden /> {t.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.lead}</p>

        {launched ? (
          <div className="mt-8 rounded-2xl border border-primary/40 bg-primary/10 p-6">
            <p className="font-display text-lg font-bold text-primary">{t.done}</p>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{launched.mint}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <a href={`https://pump.fun/coin/${launched.mint}`} target="_blank" rel="noopener noreferrer">
                  {t.viewPump} <ExternalLink className="ml-1 h-4 w-4" aria-hidden />
                </a>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app">{t.viewRadar}</Link>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setLaunched(null)
                  setForm(EMPTY)
                }}
              >
                {t.another}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              void launch()
            }}
          >
            <div className="max-w-[220px]">
              <ImageDrop
                url={form.image === 'uploading' ? '' : form.image}
                uploading={form.image === 'uploading'}
                onSelect={onImage}
                onPickUrl={(u) => set('image', u)}
                onRemove={() => set('image', '')}
                aspect="square"
                label={t.image}
                hint={t.imageHint}
                disabled={busy}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <div className="space-y-1.5">
                <Label htmlFor="pf-name">{t.name}</Label>
                <Input id="pf-name" maxLength={32} value={form.name} onChange={(e) => set('name', e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-symbol">{t.symbol}</Label>
                <Input
                  id="pf-symbol"
                  maxLength={10}
                  value={form.symbol}
                  onChange={(e) => set('symbol', e.target.value.replace(/^\$/, '').toUpperCase())}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pf-desc">
                {t.description} <span className="text-muted-foreground">({t.optional})</span>
              </Label>
              <Textarea id="pf-desc" maxLength={1000} rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} disabled={busy} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {(['twitter', 'telegram', 'website'] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={`pf-${k}`}>
                    {t[k]} <span className="text-muted-foreground">({t.optional})</span>
                  </Label>
                  <Input id={`pf-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} disabled={busy} />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pf-buy">{t.buy}</Label>
              <Input
                id="pf-buy"
                inputMode="decimal"
                className="max-w-[160px]"
                value={form.buy}
                onChange={(e) => set('buy', e.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">{t.buyHint}</p>
            </div>

            <p className="text-xs text-muted-foreground">
              {t.costs} {feeSol > 0 && t.fee(feeSol)}
            </p>

            <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Rocket className="mr-2 h-4 w-4" aria-hidden />}
              {label}
            </Button>
          </form>
        )}
      </main>
      {picker}
    </div>
  )
}
