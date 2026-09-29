'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUI } from '@/lib/store'
import { CalendarClock, ExternalLink, Loader2, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { Keypair, VersionedTransaction } from '@solana/web3.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImageDrop } from '@/components/cabal/image-drop'
import { useConnectedAddress, useWalletPicker } from '@/components/cabal/wallet-picker'
import { uploadImage } from '@/lib/api-client'
import { isUserRejection, solanaSignAndSend, solanaSignTransactions } from '@/lib/wallets'
import { useLang } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'
import { NETWORKS } from '@/lib/cabal'
import { NetworkIcon } from '@/components/cabal/shared'
import { LAUNCH_PLATFORMS, launchPlatform } from '@/lib/launch-platforms'

/**
 * Pestaña "Crear token" de /app — crear un token en pump.fun sin salir de Cabal (SDK oficial), al
 * momento o programado para una hora exacta.
 *
 * Al momento:
 *   1. El navegador genera la clave del token nuevo (nunca sale de aquí).
 *   2. /api/pump/prepare guarda el metadata y arma las transacciones.
 *   3. Firma la wallet del creador y después la clave del token.
 *   4. /api/pump/confirm las manda a la red y publica el launch en el Radar.
 *
 * Programado (/api/pump/schedule): dos firmas. La primera crea los nonces
 * duraderos y paga la comisión; la segunda deja firmado el lanzamiento, que
 * el servidor manda a la hora elegida.
 */

const TXT = {
  es: {
    back: 'Volver',
    title: 'Lanza tu token',
    lead: 'Elige el launchpad: se crea con tu wallet y sale publicado en el Radar de Cabal como launch tuyo. Tú firmas: Cabal nunca ve tus claves.',
    platform: 'Plataforma',
    soon: 'Pronto',
    soonBtn: (n: string) => `${n}: próximamente`,
    now: 'Lanzar ahora',
    schedule: 'Programar',
    when: 'Fecha y hora del lanzamiento',
    whenHint: 'En tu hora local. Entre 3 minutos y 7 días desde ahora.',
    fundsTitle: 'Deja los fondos en tu wallet hasta la hora del lanzamiento',
    fundsBody: (buy: string) =>
      `Al programar solo pagas la comisión. El lanzamiento se paga a la hora elegida desde la misma wallet: necesitarás ${buy} SOL de compra inicial más ~0,05 SOL de tarifas del launchpad y de la red. Si en ese momento no hay saldo, el lanzamiento falla y no se reintenta: podrás cancelarlo, recuperar lo reservado y volver a programarlo, pero la comisión no se devuelve.`,
    scheduleInfo:
      'Firmas dos veces: la primera paga la comisión y reserva ~0,0015 SOL por transacción (te lo devolvemos si cancelas); la segunda deja firmado el lanzamiento. A la hora exacta Cabal lo manda a la red. Mantén en tu wallet el SOL de la compra inicial y de las tarifas del launchpad hasta entonces. La dirección del token no se publica hasta que sale.',
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
    buyHint: 'Lo que compras tú al crearlo, justo después de la creación. 0 = no compras.',
    costs: 'El launchpad cobra su tarifa de creación y la red una pequeña comisión; tu wallet te muestra el total antes de firmar.',
    fee: (sol: number) => `Comisión de Cabal: ${sol} SOL.`,
    feeScheduled: 'Se cobra al programar y no se devuelve si cancelas.',
    launch: 'Lanzar token',
    scheduleBtn: 'Programar lanzamiento',
    connect: 'Conectar wallet',
    preparing: 'Preparando…',
    signing: 'Firma en tu wallet…',
    signing1: 'Firma 1 de 2 en tu wallet…',
    signing2: 'Firma 2 de 2 en tu wallet…',
    sending: 'Publicando en la red…',
    missing: 'Completa imagen, nombre y ticker',
    missingWhen: 'Elige la fecha y la hora',
    imageUp: 'Imagen subida',
    done: '¡Token lanzado!',
    scheduled: '¡Lanzamiento programado!',
    scheduledFor: (d: string) => `Sale el ${d}. Ya aparece en el Radar como próximo lanzamiento.`,
    viewPump: (n: string) => `Ver en ${n}`,
    viewRadar: 'Ver en el Radar',
    another: 'Lanzar otro',
    mine: 'Tus lanzamientos',
    cancel: 'Cancelar',
    refund: 'Recuperar SOL reservado',
    claim: (sol: string) => `Reclamar ${sol} SOL`,
    claimed: 'Comisiones enviadas a tu wallet',
    nothingToClaim: 'Sin comisiones por reclamar',
    cabalHint: 'Launchpad de Cabal: ganas casi el doble por operación que en pump.fun.',
    cancelled: 'Cancelado. Firmaste la devolución del SOL reservado.',
    refunded: 'SOL reservado devuelto a tu wallet',
    status: {
      scheduled: 'Programado',
      sending: 'Lanzando…',
      launched: 'Lanzado',
      failed: 'Falló',
      cancelled: 'Cancelado',
      draft: 'Sin terminar',
    } as Record<string, string>,
  },
  en: {
    back: 'Back',
    title: 'Launch your token',
    lead: 'Pick the launchpad: it is created with your wallet and published on the Cabal Radar as your launch. You sign: Cabal never sees your keys.',
    platform: 'Platform',
    soon: 'Soon',
    soonBtn: (n: string) => `${n}: coming soon`,
    now: 'Launch now',
    schedule: 'Schedule',
    when: 'Launch date and time',
    whenHint: 'In your local time. Between 3 minutes and 7 days from now.',
    fundsTitle: 'Keep the funds in your wallet until launch time',
    fundsBody: (buy: string) =>
      `Scheduling only charges the fee. The launch is paid at the chosen time from the same wallet: you will need ${buy} SOL for the initial buy plus ~0.05 SOL in launchpad and network fees. If the balance is not there at that moment, the launch fails and is not retried: you can cancel it, recover what was reserved and schedule it again, but the fee is not refunded.`,
    scheduleInfo:
      'You sign twice: the first pays the fee and reserves ~0.0015 SOL per transaction (refunded if you cancel); the second pre-signs the launch. At the exact time Cabal sends it on-chain. Keep the SOL for the initial buy and launchpad fees in your wallet until then. The token address is not published until it goes live.',
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
    buyHint: 'What you buy right after it is created. 0 = no buy.',
    costs: 'The launchpad charges its creation fee and the network a small fee; your wallet shows the total before you sign.',
    fee: (sol: number) => `Cabal fee: ${sol} SOL.`,
    feeScheduled: 'Charged when scheduling and not refunded if you cancel.',
    launch: 'Launch token',
    scheduleBtn: 'Schedule launch',
    connect: 'Connect wallet',
    preparing: 'Preparing…',
    signing: 'Sign in your wallet…',
    signing1: 'Signature 1 of 2 in your wallet…',
    signing2: 'Signature 2 of 2 in your wallet…',
    sending: 'Publishing on-chain…',
    missing: 'Fill in image, name and ticker',
    missingWhen: 'Pick the date and time',
    imageUp: 'Image uploaded',
    done: 'Token launched!',
    scheduled: 'Launch scheduled!',
    scheduledFor: (d: string) => `It goes live on ${d}. It already shows on the Radar as an upcoming launch.`,
    viewPump: (n: string) => `View on ${n}`,
    viewRadar: 'View on the Radar',
    another: 'Launch another',
    mine: 'Your launches',
    cancel: 'Cancel',
    refund: 'Recover reserved SOL',
    claim: (sol: string) => `Claim ${sol} SOL`,
    claimed: 'Fees sent to your wallet',
    nothingToClaim: 'No fees to claim',
    cabalHint: "Cabal's launchpad: you earn almost double per trade than on pump.fun.",
    cancelled: 'Cancelled. You signed the refund of the reserved SOL.',
    refunded: 'Reserved SOL returned to your wallet',
    status: {
      scheduled: 'Scheduled',
      sending: 'Launching…',
      launched: 'Launched',
      failed: 'Failed',
      cancelled: 'Cancelled',
      draft: 'Unfinished',
    } as Record<string, string>,
  },
}

const EMPTY = { name: '', symbol: '', description: '', image: '', twitter: '', telegram: '', website: '', buy: '0', when: '' }

type Step = 'idle' | 'preparing' | 'signing' | 'signing1' | 'signing2' | 'sending'
type Mode = 'now' | 'schedule'
type Done = { mint: string | null; scheduledAt: string | null; platform: string }
type MyCoin = {
  platform: string
  key: string
  mint: string | null
  name: string
  symbol: string
  image: string
  status: string
  scheduledAt: string | null
  launchedAt: string | null
  error: string | null
  hasNonces: boolean
  creatorFeesSol: number | null
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data as T
}

const fromB64 = (b: string) => VersionedTransaction.deserialize(Buffer.from(b, 'base64'))
const toB64 = (tx: VersionedTransaction) => Buffer.from(tx.serialize()).toString('base64')

/** Firma con `kp` solo las transacciones que la piden (el mint firma la de creación). */
function signWhereNeeded(txs: VersionedTransaction[], kp: Keypair) {
  for (const tx of txs) {
    const signers = tx.message.staticAccountKeys.slice(0, tx.message.header.numRequiredSignatures)
    if (signers.some((k) => k.equals(kp.publicKey))) tx.sign([kp])
  }
}

/** Ficha del token en su launchpad. */
function coinUrl(platform: string, mint: string): { url: string; label: string } {
  if (platform === 'bonk') return { url: `https://raydium.io/launchpad/token/?mint=${mint}`, label: 'Raydium' }
  if (platform === 'cabal') return { url: `https://solscan.io/token/${mint}`, label: 'Solscan' }
  return { url: `https://pump.fun/coin/${mint}`, label: 'pump.fun' }
}

export function LaunchTab() {
  const [lang] = useLang()
  const t = TXT[lang] ?? TXT.es
  const [form, setForm] = useState(EMPTY)
  const [mode, setMode] = useState<Mode>('now')
  const [platformId, setPlatformId] = useState('pump')
  const platform = launchPlatform(platformId)
  const [cabalReady, setCabalReady] = useState(false)
  // Cabal Launch solo lanza cuando su configuración ya está creada en /admin
  const isLive = (p: { id: string; live: boolean }) => p.live && (p.id !== 'cabal' || cabalReady)
  const [step, setStep] = useState<Step>('idle')
  const [fees, setFees] = useState<Record<string, number>>({})
  const [done, setDone] = useState<Done | null>(null)
  const [mine, setMine] = useState<MyCoin[]>([])
  const pubkey = useConnectedAddress('solana')
  const { requestWallet, picker } = useWalletPicker('solana')

  const loadMine = useCallback(() => {
    fetch('/api/pump/schedule')
      .then((r) => r.json())
      .then((d: MyCoin[]) => setMine(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // La comisión se enseña antes de firmar, no solo en la wallet
  useEffect(() => {
    fetch('/api/pump/fee')
      .then((r) => r.json())
      .then((d: { fees?: Record<string, number>; cabalReady?: boolean }) => {
        setFees(d.fees ?? {})
        setCabalReady(Boolean(d.cabalReady))
      })
      .catch(() => {})
    loadMine()
  }, [loadMine])

  // Un programado cambia de estado solo: se refresca mientras haya alguno pendiente
  useEffect(() => {
    if (!mine.some((c) => c.status === 'scheduled' || c.status === 'sending')) return
    const id = setInterval(loadMine, 15_000)
    return () => clearInterval(id)
  }, [mine, loadMine])

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

  const payload = (mint: string, creator: string) => ({
    platform: platformId,
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

  const launchNow = async (creator: string) => {
    const mintKp = Keypair.generate()
    const mint = mintKp.publicKey.toBase58()
    setStep('preparing')
    const prep = await postJson<{ txs: string[] }>('/api/pump/prepare', payload(mint, creator))

    setStep('signing')
    // La wallet firma primero (todas de una vez); la clave del token, después
    // y solo la creación
    const signed = await solanaSignTransactions(prep.txs.map(fromB64))
    signWhereNeeded(signed, mintKp)

    setStep('sending')
    const res = await postJson<{ buyError: string | null }>('/api/pump/confirm', { mint, txs: signed.map(toB64) })
    setDone({ mint, scheduledAt: null, platform: platformId })
    toast.success(t.done)
    if (res.buyError) toast.warning(res.buyError)
  }

  const launchScheduled = async (creator: string) => {
    const mintKp = Keypair.generate()
    const mint = mintKp.publicKey.toBase58()
    const buy = Number(form.buy.replace(',', '.')) || 0
    // Un nonce por transacción del lanzamiento: crear y, si hay, comprar
    // Un nonce por transacción del lanzamiento; el servidor dice cuántas usa
    const nonceKps = Array.from({ length: 3 }, () => Keypair.generate())

    setStep('preparing')
    const setup = await postJson<{ tx: string; nonceAccounts: string[] }>('/api/pump/schedule', {
      step: 'setup',
      ...payload(mint, creator),
      scheduledAt: new Date(form.when).toISOString(),
      nonceAccounts: nonceKps.map((k) => k.publicKey.toBase58()),
    })

    setStep('signing1')
    const [setupSigned] = await solanaSignTransactions([fromB64(setup.tx)])
    setupSigned.sign(nonceKps.filter((k) => setup.nonceAccounts.includes(k.publicKey.toBase58())))

    setStep('sending')
    const commit = await postJson<{ txs: string[] }>('/api/pump/schedule', { step: 'commit', mint, tx: toB64(setupSigned) })

    setStep('signing2')
    const signed = await solanaSignTransactions(commit.txs.map(fromB64))
    signWhereNeeded(signed, mintKp)

    setStep('sending')
    const fin = await postJson<{ scheduledAt: string }>('/api/pump/schedule', { step: 'finalize', mint, txs: signed.map(toB64) })
    setDone({ mint: null, scheduledAt: fin.scheduledAt, platform: platformId })
    toast.success(t.scheduled)
    loadMine()
  }

  const submit = async () => {
    if (!form.image || form.image === 'uploading' || !form.name.trim() || !form.symbol.trim()) {
      toast.error(t.missing)
      return
    }
    if (mode === 'schedule' && !form.when) {
      toast.error(t.missingWhen)
      return
    }
    const creator = await requestWallet()
    if (!creator) return
    try {
      await (mode === 'now' ? launchNow(creator) : launchScheduled(creator))
    } catch (e) {
      if (!isUserRejection(e)) toast.error((e as Error).message)
    } finally {
      setStep('idle')
    }
  }

  // Cancelar un programado (o, ya lanzado, recuperar el SOL de sus nonces):
  // la wallet firma la retirada del alquiler, que invalida lo guardado
  const cancelOrRefund = async (c: MyCoin) => {
    if (!(await requestWallet())) return
    try {
      const res = await postJson<{ tx: string }>('/api/pump/schedule', { step: 'cancel', mint: c.key })
      await solanaSignAndSend(fromB64(res.tx))
      toast.success(c.status === 'launched' ? t.refunded : t.cancelled)
    } catch (e) {
      if (!isUserRejection(e)) toast.error((e as Error).message)
    } finally {
      loadMine()
    }
  }

  const feeSol = fees[platformId] ?? 0
  // Cabal Launch: el dev cobra su 70 % de las comisiones del token con su wallet
  const claimFees = async (c: MyCoin) => {
    if (!(await requestWallet())) return
    try {
      const res = await postJson<{ tx: string }>('/api/pump/claim', { mint: c.key })
      await solanaSignAndSend(fromB64(res.tx))
      toast.success(t.claimed)
    } catch (e) {
      if (!isUserRejection(e)) toast.error((e as Error).message)
    } finally {
      loadMine()
    }
  }

  const busy = step !== 'idle'
  const idleLabel = !isLive(platform)
    ? t.soonBtn(platform.name)
    : !pubkey
      ? t.connect
      : mode === 'now'
        ? t.launch
        : t.scheduleBtn
  const label = step === 'idle' ? idleLabel : t[step]
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === 'en' ? 'en' : 'es', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl">
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Rocket className="h-6 w-6 text-primary" aria-hidden /> {t.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.lead}</p>

        {done ? (
          <div className="mt-8 rounded-2xl border border-primary/40 bg-primary/10 p-6">
            <p className="font-display text-lg font-bold text-primary">{done.mint ? t.done : t.scheduled}</p>
            {done.mint ? (
              <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{done.mint}</p>
            ) : (
              done.scheduledAt && <p className="mt-2 text-sm text-muted-foreground">{t.scheduledFor(fmt(done.scheduledAt))}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {done.mint && (
                <Button asChild>
                  <a href={coinUrl(done.platform, done.mint).url} target="_blank" rel="noopener noreferrer">
                    {t.viewPump(coinUrl(done.platform, done.mint).label)} <ExternalLink className="ml-1 h-4 w-4" aria-hidden />
                  </a>
                </Button>
              )}
              <Button variant="secondary" onClick={() => useUI.getState().setTab('radar')}>
                {t.viewRadar}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDone(null)
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
              void submit()
            }}
          >
            <fieldset className="space-y-2">
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
                {t.platform}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <NetworkIcon network={platform.network} /> {NETWORKS[platform.network].short}
                </span>
              </legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {LAUNCH_PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={platformId === p.id}
                    disabled={busy}
                    onClick={() => setPlatformId(p.id)}
                    className={cn(
                      'relative flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-semibold transition-colors',
                      platformId === p.id
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-white/10 bg-white/[0.03] text-foreground/80 hover:border-white/25',
                      !isLive(p) && 'opacity-60',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.logo} alt="" className="h-5 w-5 shrink-0 rounded-md object-cover" />
                    {p.name}
                    <NetworkIcon network={p.network} className="h-3 w-3 opacity-70" />
                    {!isLive(p) && (
                      <span className="absolute -right-1 -top-1.5 rounded bg-amber-400/90 px-1 text-[9px] font-bold uppercase text-black">
                        {t.soon}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {platformId === 'cabal' && <p className="text-xs font-semibold text-amber-300">{t.cabalHint}</p>}
            </fieldset>

            <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
              {(['now', 'schedule'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  disabled={busy}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors',
                    mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m === 'now' ? <Rocket className="h-4 w-4" aria-hidden /> : <CalendarClock className="h-4 w-4" aria-hidden />}
                  {m === 'now' ? t.now : t.schedule}
                </button>
              ))}
            </div>

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
                <Input id="pf-name" maxLength={platform.limits.name} value={form.name} onChange={(e) => set('name', e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-symbol">{t.symbol}</Label>
                <Input
                  id="pf-symbol"
                  maxLength={platform.limits.symbol}
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

            {mode === 'schedule' && (
              <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <Label htmlFor="pf-when">{t.when}</Label>
                <Input
                  id="pf-when"
                  type="datetime-local"
                  className="max-w-[240px]"
                  value={form.when}
                  onChange={(e) => set('when', e.target.value)}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">{t.whenHint}</p>
                <p className="pt-2 text-xs leading-relaxed text-muted-foreground">{t.scheduleInfo}</p>
                <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3" role="note">
                  <p className="text-xs font-bold text-amber-300">⚠ {t.fundsTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
                    {t.fundsBody(String(Number(form.buy.replace(',', '.')) || 0))}
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {t.costs} {feeSol > 0 && t.fee(feeSol)} {feeSol > 0 && mode === 'schedule' && t.feeScheduled}
            </p>

            <Button type="submit" size="lg" disabled={busy || !isLive(platform)} className="w-full sm:w-auto">
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : mode === 'now' ? (
                <Rocket className="mr-2 h-4 w-4" aria-hidden />
              ) : (
                <CalendarClock className="mr-2 h-4 w-4" aria-hidden />
              )}
              {label}
            </Button>
          </form>
        )}

        {mine.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-lg font-bold">{t.mine}</h2>
            <ul className="mt-3 space-y-2">
              {mine.map((c) => (
                <li key={c.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {c.name} <span className="text-muted-foreground">${c.symbol}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.status[c.status] ?? c.status}
                      {c.status === 'scheduled' && c.scheduledAt && ` · ${fmt(c.scheduledAt)}`}
                      {c.status === 'launched' && c.launchedAt && ` · ${fmt(c.launchedAt)}`}
                    </p>
                    {c.error && <p className="mt-0.5 text-xs text-amber-400">{c.error}</p>}
                  </div>
                  {c.mint && (
                    <Button asChild size="sm" variant="secondary">
                      <a href={coinUrl(c.platform, c.mint).url} target="_blank" rel="noopener noreferrer">
                        {coinUrl(c.platform, c.mint).label} <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
                      </a>
                    </Button>
                  )}
                  {(c.status === 'scheduled' || c.status === 'failed') && (
                    <Button size="sm" variant="ghost" onClick={() => void cancelOrRefund(c)}>
                      {t.cancel}
                    </Button>
                  )}
                  {c.creatorFeesSol !== null && (
                    <Button
                      size="sm"
                      className="bg-amber-400 font-bold text-black hover:bg-amber-300"
                      disabled={c.creatorFeesSol <= 0}
                      onClick={() => void claimFees(c)}
                    >
                      {c.creatorFeesSol > 0 ? t.claim(c.creatorFeesSol.toFixed(4)) : t.nothingToClaim}
                    </Button>
                  )}
                  {(c.status === 'launched' || c.status === 'cancelled') && c.hasNonces && (
                    <Button size="sm" variant="ghost" onClick={() => void cancelOrRefund(c)}>
                      {t.refund}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {picker}
    </div>
  )
}
