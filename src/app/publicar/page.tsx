'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarClock, CheckCircle2, Code2, Crown, EyeOff, Hash, MonitorPlay, Radar, Rocket, Wallet, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CabalWordmark, NetworkIcon, TimezoneHint } from '@/components/cabal/shared'
import { ImageDrop } from '@/components/cabal/image-drop'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { LAUNCHPADS, NETWORKS, type NetworkKey } from '@/lib/cabal'
import { uploadImage, useCreateLaunch, useLaunch, usePointRules, useUpdateLaunch } from '@/lib/api-client'
import type { TokenMeta } from '@/lib/chain-stats'
import type { LaunchDetailDTO } from '@/lib/types'
import { useUI } from '@/lib/store'

const EMPTY_FORM = {
  name: '',
  ticker: '',
  network: 'solana',
  launchAt: '',
  contract: '',
  description: '',
  website: '',
  twitter: '',
  telegram: '',
  image: '',
  banner: '',
  liveUrl: '',
  devWallet: '',
  launchpad: '',
}

type FormInitial = {
  form: typeof EMPTY_FORM
  isPrivate: boolean
  isLive: boolean
  dateConfirmed: boolean
  submitterRole: 'dev' | 'community'
}

const EMPTY_INITIAL: FormInitial = {
  form: EMPTY_FORM,
  isPrivate: false,
  isLive: false,
  dateConfirmed: true,
  submitterRole: 'community',
}

/** Fecha ISO a lo que espera un <input type="datetime-local">, en hora local. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Valores del formulario a partir de un launch ya publicado. */
function fromLaunch(l: LaunchDetailDTO): FormInitial {
  return {
    form: {
      name: l.name,
      ticker: l.ticker ?? '',
      network: l.network,
      launchAt: toLocalInput(l.launchAt),
      contract: l.contract ?? '',
      description: l.description,
      website: l.website ?? '',
      twitter: l.twitter ?? '',
      telegram: l.telegram ?? '',
      image: l.image ?? '',
      banner: l.banner ?? '',
      liveUrl: l.liveUrl ?? '',
      devWallet: l.devWallet ?? '',
      launchpad: l.launchpad ?? '',
    },
    isPrivate: l.isPrivate,
    isLive: l.isLive,
    dateConfirmed: l.dateConfirmed,
    submitterRole: l.submitterRole,
  }
}

/**
 * /publicar crea un launch; /publicar?edit=<id> edita uno existente con el
 * mismo formulario. El servidor solo deja editar a quien lo publicó o a un admin
 * (ver PATCH /api/launches/[id]); aquí se comprueba antes para no enseñar un
 * formulario que luego no se podría guardar.
 */
export default function PublicarLaunchPage() {
  const t = useT()
  // ?edit= se lee tras montar: al prerenderizar la página no existe window
  const [mode, setMode] = useState<{ ready: boolean; editId: string | null }>({ ready: false, editId: null })
  useEffect(() => {
    const timer = setTimeout(
      () => setMode({ ready: true, editId: new URLSearchParams(window.location.search).get('edit') }),
      0
    )
    return () => clearTimeout(timer)
  }, [])
  const editing = useLaunch(mode.editId)

  if (!mode.ready) return null
  if (!mode.editId) return <LaunchForm initial={EMPTY_INITIAL} />
  if (editing.isPending) return <FormNotice>{t.publish.loadingLaunch}</FormNotice>
  if (!editing.data) return <FormNotice>{t.publish.notFound}</FormNotice>
  if (!editing.data.canEdit) {
    return <FormNotice>{t.publish.notYours}</FormNotice>
  }
  // key: si cambia el launch que se edita, el formulario arranca de cero
  return <LaunchForm key={mode.editId} initial={fromLaunch(editing.data)} editId={mode.editId} />
}

/** Aviso a pantalla completa mientras carga el launch o si no se puede editar. */
function FormNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
      <Link href="/app" className="text-sm font-semibold text-primary hover:underline">
        Volver al radar
      </Link>
    </div>
  )
}

function LaunchForm({ initial, editId }: { initial: FormInitial; editId?: string }) {
  const t = useT()
  const router = useRouter()
  const { openLaunch } = useUI()
  const createLaunch = useCreateLaunch()
  const rules = usePointRules()
  const updateLaunch = useUpdateLaunch(editId ?? '')
  const saving = editId ? updateLaunch.isPending : createLaunch.isPending
  const [form, setForm] = useState(initial.form)
  const [isPrivate, setIsPrivate] = useState(initial.isPrivate)
  const [isLive, setIsLive] = useState(initial.isLive)
  const [dateConfirmed, setDateConfirmed] = useState(initial.dateConfirmed)
  const [submitterRole, setSubmitterRole] = useState<'dev' | 'community'>(initial.submitterRole)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [earned, setEarned] = useState(0)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Autocompletar por CA: al pegar un contrato válido se busca en DexScreener /
  // pump.fun y se rellenan los campos vacíos (nunca pisa lo que ya escribió).
  const [lookup, setLookup] = useState<{ state: 'idle' | 'loading' | 'found' | 'notfound'; source?: string }>({ state: 'idle' })
  const lookupCa = form.contract.trim()
  // Al editar, el CA ya guardado no se vuelve a buscar: rellenaría campos que
  // quizá se vaciaron a propósito y avisaría de "token encontrado" al abrir.
  const savedCa = editId ? initial.form.contract.trim() : null
  useEffect(() => {
    if (lookupCa === savedCa || !/^[a-zA-Z0-9]{32,44}$|^0x[a-fA-F0-9]{40}$/.test(lookupCa)) {
      setLookup({ state: 'idle' })
      return
    }
    let cancelled = false
    setLookup({ state: 'loading' })
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tokens/lookup?ca=${encodeURIComponent(lookupCa)}`)
        const meta = (await res.json()) as TokenMeta
        if (cancelled) return
        if (!res.ok || !meta.found) {
          setLookup({ state: 'notfound' })
          return
        }
        setForm((f) => ({
          ...f,
          network: meta.network || f.network,
          name: f.name || meta.name,
          ticker: f.ticker || meta.symbol,
          image: f.image || meta.image,
          banner: f.banner || meta.banner,
          description: f.description || meta.description,
          website: f.website || meta.website,
          twitter: f.twitter || meta.twitter,
          telegram: f.telegram || meta.telegram,
        }))
        setLookup({ state: 'found', source: meta.source === 'pumpfun' ? 'pump.fun' : 'DexScreener' })
        toast.success(t.publish.toasts.found(meta.symbol ? `$${meta.symbol}` : 'Token'), {
          description: t.publish.toasts.foundBody,
        })
      } catch {
        if (!cancelled) setLookup({ state: 'notfound' })
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [lookupCa, savedCa])

  const handleSelect = (key: 'image' | 'banner') => async (file: File) => {
    setError('')
    setForm((f) => ({ ...f, [key]: 'uploading' }))
    try {
      const url = await uploadImage(file)
      setForm((f) => ({ ...f, [key]: url }))
      toast.success(key === 'image' ? t.publish.toasts.imageUp : t.publish.toasts.bannerUp)
    } catch (e) {
      setForm((f) => ({ ...f, [key]: '' }))
      toast.error((e as Error).message, {
        description: t.publish.toasts.urlTip,
      })
    }
  }

  const uploading = form.image === 'uploading' || form.banner === 'uploading'

  const submit = () => {
    setError('')
    // En móvil la subida tarda: publicar antes de que termine dejaba el launch sin imagen
    if (uploading) {
      setError(t.publish.errors.uploading)
      return
    }
    if (!form.name.trim() || !form.launchAt) {
      setError(t.publish.errors.required)
      return
    }
    if (!form.ticker.trim() && !isPrivate) {
      setError(t.publish.errors.tickerOrPrivate)
      return
    }
    const contract = form.contract.trim()
    if (contract && !/^[a-zA-Z0-9:_-]{2,80}$/.test(contract)) {
      setError(t.publish.errors.contract)
      return
    }
    const liveUrl = form.liveUrl.trim()
    if (isLive && !/^https:\/\//.test(liveUrl)) {
      setError(t.publish.errors.liveUrl)
      return
    }
    // datetime-local se interpreta en la zona horaria del dispositivo del publicador;
    // se convierte a instante absoluto (ISO UTC) para que cada usuario lo vea en su hora local
    const launchAtIso = new Date(form.launchAt).toISOString()
    const payload = {
      ...form,
      contract,
      launchAt: launchAtIso,
      dateConfirmed: String(dateConfirmed),
      submitterRole,
      image: form.image === 'uploading' ? '' : form.image,
      banner: form.banner === 'uploading' ? '' : form.banner,
      isPrivate: String(isPrivate),
      isLive: String(isLive),
      liveUrl: isLive ? liveUrl : '',
    }
    if (editId) {
      updateLaunch.mutate(payload, {
        onSuccess: () => {
          toast.success(t.publish.toasts.saved)
          // De vuelta al radar con la ficha abierta, para ver el resultado
          openLaunch(editId)
          router.push('/app')
        },
        onError: (e: Error) => {
          setError(e.message)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        },
      })
      return
    }
    createLaunch.mutate(
      payload,
      {
        onSuccess: (data) => {
          setEarned(data.pointsEarned)
          setDone(true)
          window.scrollTo({ top: 0, behavior: 'smooth' })
          toast.success(t.publish.toasts.published, { description: t.publish.toasts.publishedPoints(data.pointsEarned) })
        },
        onError: (e: Error) => {
          setError(e.message)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        },
      }
    )
  }

  const reset = () => {
    setForm(EMPTY_FORM)
    setIsPrivate(false)
    setIsLive(false)
    setDateConfirmed(true)
    setSubmitterRole('community')
    setError('')
    setDone(false)
    setEarned(0)
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0b08]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-3 px-3 sm:px-4">
          <Link
            href="/app"
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> <span className="hidden min-[400px]:inline">{t.publish.back}</span>
          </Link>
          <Link href="/app" className="ml-1 flex min-w-0 items-center outline-none transition-opacity hover:opacity-80" aria-label={t.publish.goHome}>
            <CabalWordmark />
          </Link>
          {!editId && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#8FA83F]/25 bg-[#8FA83F]/8 px-2.5 py-1 text-xs font-semibold text-primary">
              <Zap className="h-3 w-3" aria-hidden /> +{rules.points_launch} pts por launch
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-2xl flex-1 px-3 pb-16 pt-6 sm:px-4 sm:pt-8">
        {done ? (
          <SuccessPanel
            earned={earned || rules.points_launch}
            ticker={form.ticker}
            onReset={reset}
            onGoRadar={() => router.push('/app')}
          />
        ) : (
          <>
            {/* Page heading */}
            <div className="mb-5">
              <h1 className="font-machina flex items-center gap-2.5 text-xl font-bold sm:text-2xl uppercase tracking-wide">
                <Rocket className="h-6 w-6 text-primary" aria-hidden /> {editId ? t.publish.titleEdit : t.publish.titleNew}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {editId ? t.publish.leadEdit : t.publish.leadNew(rules.points_hype_received)}
              </p>
            </div>

            {/* Form */}
            <div className="card-surface min-w-0 space-y-5 rounded-2xl border border-white/10 p-4 sm:p-6">
              {/* ¿Quién publica este launch? (obligatorio) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t.publish.whoPosts}</Label>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t.publish.whoPostsAria}>
                  <RoleOption
                    active={submitterRole === 'dev'}
                    onClick={() => setSubmitterRole('dev')}
                    icon={<Code2 className="h-3.5 w-3.5" aria-hidden />}
                    title={t.publish.roleDev}
                    subtitle={t.publish.roleDevSub}
                  />
                  <RoleOption
                    active={submitterRole === 'community'}
                    onClick={() => setSubmitterRole('community')}
                    icon={<Radar className="h-3.5 w-3.5" aria-hidden />}
                    title={t.publish.roleCommunity}
                    subtitle={t.publish.roleCommunitySub}
                  />
                </div>
                {/* Un dev que aún no ha sacado su token puede crearlo o
                    programarlo desde Cabal y ahorrarse publicarlo a mano */}
                {submitterRole === 'dev' && !editId && (
                  <div className="mt-2 flex flex-col gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 p-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-amber-300">
                        <CalendarClock className="h-4 w-4" aria-hidden /> {t.publish.devLaunchTitle}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-foreground/75">{t.publish.devLaunchBody}</p>
                    </div>
                    <Button asChild size="sm" className="shrink-0 bg-amber-400 font-bold text-black hover:bg-amber-300">
                      <Link href="/lanzar">{t.publish.devLaunchCta}</Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* Nombre + ticker */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pl-name" className="text-xs font-semibold">{t.publish.name}</Label>
                  <Input id="pl-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t.publish.namePlaceholder} className="h-10 bg-[#0a0b08]" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-ticker" className="text-xs font-semibold">
                    {t.publish.ticker} <span className="font-normal text-muted-foreground">{t.publish.optional}</span>
                  </Label>
                  <Input
                    id="pl-ticker"
                    value={form.ticker}
                    onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                    placeholder={isPrivate ? t.publish.tickerReserved : 'SMOL'}
                    disabled={false}
                    className="h-10 bg-[#0a0b08] font-mono"
                  />
                </div>
              </div>

              {/* Modo privado: reserva el ticker y anuncia sin revelarlo */}
              <button
                type="button"
                onClick={() => setIsPrivate((v) => !v)}
                aria-pressed={isPrivate}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all',
                  isPrivate
                    ? 'border-amber-300/40 bg-amber-300/8'
                    : 'border-white/10 bg-[#0a0b08] hover:border-white/20'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5 transition-colors',
                    isPrivate ? 'border-amber-300/50 bg-amber-300/25' : 'border-white/15 bg-white/5'
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      'h-3.5 w-3.5 rounded-full transition-transform',
                      isPrivate ? 'translate-x-4 bg-amber-300' : 'translate-x-0 bg-zinc-400'
                    )}
                  />
                </span>
                <span className="min-w-0">
                  <span className={cn('flex items-center gap-1.5 text-[13px] font-bold', isPrivate ? 'text-amber-300' : 'text-foreground')}>
                    <EyeOff className="h-3.5 w-3.5" aria-hidden /> {t.publish.privateLaunch}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {t.publish.privateBody}
                  </span>
                </span>
              </button>

              {/* Lanzamiento en vivo: streaming del launch (YouTube, Twitch…) */}
              <div
                className={cn(
                  'rounded-xl border p-3 transition-all',
                  isLive ? 'border-[#8FA83F]/40 bg-[#8FA83F]/8' : 'border-white/10 bg-[#0a0b08] hover:border-white/20'
                )}
              >
                <button
                  type="button"
                  onClick={() => setIsLive((v) => !v)}
                  aria-pressed={isLive}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5 transition-colors',
                      isLive ? 'border-[#8FA83F]/50 bg-[#8FA83F]/25' : 'border-white/15 bg-white/5'
                    )}
                    aria-hidden
                  >
                    <span
                      className={cn(
                        'h-3.5 w-3.5 rounded-full transition-transform',
                        isLive ? 'translate-x-4 bg-[#8FA83F]' : 'translate-x-0 bg-zinc-400'
                      )}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className={cn('flex items-center gap-1.5 text-[13px] font-bold', isLive ? 'text-primary' : 'text-foreground')}>
                      <MonitorPlay className="h-3.5 w-3.5" aria-hidden /> {t.publish.liveLaunch}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                      {t.publish.liveBody}
                    </span>
                  </span>
                </button>
                {isLive && (
                  <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                    <Label htmlFor="pl-live" className="text-xs font-semibold">{t.publish.liveLink}</Label>
                    <Input
                      id="pl-live"
                      value={form.liveUrl}
                      onChange={(e) => set('liveUrl', e.target.value)}
                      placeholder="https://www.youtube.com/live/…"
                      autoComplete="off"
                      spellCheck={false}
                      className="h-10 bg-[#0a0b08] text-sm"
                    />
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {t.publish.liveHint}
                    </p>
                  </div>
                )}
              </div>

              {/* Red */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t.publish.network}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(NETWORKS).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => set('network', key)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                        form.network === key
                          ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                          : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
                      )}
                    >
                      <NetworkIcon network={key} className="h-3.5 w-3.5" />
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CA del token (opcional): activa el gráfico en vivo en la ficha */}
              <div className="space-y-1.5">
                <Label htmlFor="pl-contract" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Hash className="h-3 w-3 text-primary/70" aria-hidden /> {t.publish.contract}
                  <span className="font-normal text-muted-foreground">{t.publish.optional}</span>
                </Label>
                <Input
                  id="pl-contract"
                  value={form.contract}
                  onChange={(e) => set('contract', e.target.value)}
                  placeholder={t.publish.contractPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 bg-[#0a0b08] font-mono text-sm"
                />
                {lookup.state === 'loading' ? (
                  <p className="text-[11px] font-medium text-muted-foreground">{t.publish.searchingToken}</p>
                ) : lookup.state === 'found' ? (
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Token verificado en {lookup.source}: datos rellenados
                  </p>
                ) : lookup.state === 'notfound' ? (
                  <p className="text-[11px] font-medium text-amber-300">
                    No encontramos este token en DexScreener ni pump.fun. Rellena los datos a mano.
                  </p>
                ) : (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Si el token ya fue desplegado, pega el CA y rellenamos nombre, ticker, imagen, banner y redes solos. También activa el gráfico en vivo en su ficha.
                  </p>
                )}
              </div>

              {/* Datos premium: solo los ve quien paga el plan Premium (o tu equipo) */}
              <div className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                  <Crown className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden /> {t.publish.premiumData}
                  <span className="font-normal text-muted-foreground">{t.publish.premiumDataNote}</span>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-devwallet" className="flex items-center gap-1.5 text-xs font-semibold">
                    <Wallet className="h-3 w-3 text-amber-300/80" aria-hidden /> {t.publish.devWallet}
                    <span className="font-normal text-muted-foreground">{t.publish.optional}</span>
                  </Label>
                  <Input
                    id="pl-devwallet"
                    value={form.devWallet}
                    onChange={(e) => set('devWallet', e.target.value)}
                    placeholder={t.publish.devWalletPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    className="h-10 bg-[#0a0b08] font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-launchpad" className="text-xs font-semibold">
                    {t.publish.launchpad} <span className="font-normal text-muted-foreground">{t.publish.optional}</span>
                  </Label>
                  <Input
                    id="pl-launchpad"
                    value={form.launchpad}
                    onChange={(e) => set('launchpad', e.target.value)}
                    placeholder={t.publish.launchpadPlaceholder}
                    className="h-10 bg-[#0a0b08] text-sm"
                  />
                  {(LAUNCHPADS[form.network as NetworkKey] ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {LAUNCHPADS[form.network as NetworkKey].map((lp) => (
                        <button
                          key={lp}
                          type="button"
                          onClick={() => set('launchpad', lp)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                            form.launchpad === lp
                              ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                              : 'border-white/10 text-muted-foreground hover:border-white/25'
                          )}
                        >
                          {lp}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fecha */}
              <div className="space-y-1.5">
                <Label htmlFor="pl-when" className="text-xs font-semibold">{t.publish.dateTime}</Label>
                <Input
                  id="pl-when"
                  type="datetime-local"
                  value={form.launchAt}
                  onChange={(e) => set('launchAt', e.target.value)}
                  className="h-10 w-full min-w-0 max-w-sm appearance-none bg-[#0a0b08] text-left [color-scheme:dark] [&::-webkit-date-and-time-value]:text-left"
                />
                <TimezoneHint value={form.launchAt} className="max-w-sm" />
                <button
                  type="button"
                  onClick={() => setDateConfirmed((v) => !v)}
                  aria-pressed={!dateConfirmed}
                  className={cn(
                    'mt-1 flex w-full max-w-sm items-start gap-2.5 rounded-lg border p-2 text-left transition-all',
                    !dateConfirmed
                      ? 'border-amber-300/40 bg-amber-300/8'
                      : 'border-white/10 bg-[#0a0b08] hover:border-white/20'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full border px-0.5 transition-colors',
                      !dateConfirmed ? 'border-amber-300/50 bg-amber-300/25' : 'border-white/15 bg-white/5'
                    )}
                    aria-hidden
                  >
                    <span
                      className={cn(
                        'h-3 w-3 rounded-full transition-transform',
                        !dateConfirmed ? 'translate-x-3 bg-amber-300' : 'translate-x-0 bg-zinc-400'
                      )}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-[12px] font-bold', !dateConfirmed ? 'text-amber-300' : 'text-foreground')}>
                      {t.publish.dateUnconfirmed}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                      {t.publish.dateUnconfirmedBody}
                    </span>
                  </span>
                </button>
              </div>

              {/* Identidad visual: imagen del token + banner */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 [&>*]:min-w-0">
                <ImageDrop
                  url={form.image === 'uploading' ? '' : form.image}
                  uploading={form.image === 'uploading'}
                  onSelect={handleSelect('image')}
                  onPickUrl={(u) => set('image', u)}
                  onRemove={() => set('image', '')}
                  aspect="square"
                  label={t.publish.tokenImage}
                  hint={t.publish.uploadImage}
                  disabled={saving}
                />
                <ImageDrop
                  url={form.banner === 'uploading' ? '' : form.banner}
                  uploading={form.banner === 'uploading'}
                  onSelect={handleSelect('banner')}
                  onPickUrl={(u) => set('banner', u)}
                  onRemove={() => set('banner', '')}
                  aspect="video"
                  label={t.publish.banner}
                  hint="Sube un banner (16:9)"
                  disabled={saving}
                />
              </div>

              {/* Pitch */}
              <div className="space-y-1.5">
                <Label htmlFor="pl-desc" className="text-xs font-semibold">{t.publish.pitch}</Label>
                <Textarea
                  id="pl-desc"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder={t.publish.pitchPlaceholder}
                  className="min-h-[88px] resize-none bg-[#0a0b08]"
                />
              </div>

              {/* Links */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pl-web" className="text-xs font-semibold text-muted-foreground">{t.publish.website}</Label>
                  <Input id="pl-web" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" className="h-9 bg-[#0a0b08] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-x" className="text-xs font-semibold text-muted-foreground">{t.publish.x}</Label>
                  <Input id="pl-x" value={form.twitter} onChange={(e) => set('twitter', e.target.value)} placeholder="https://x.com/…" className="h-9 bg-[#0a0b08] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-tg" className="text-xs font-semibold text-muted-foreground">{t.publish.telegram}</Label>
                  <Input id="pl-tg" value={form.telegram} onChange={(e) => set('telegram', e.target.value)} placeholder="https://t.me/…" className="h-9 bg-[#0a0b08] text-sm" />
                </div>
              </div>

              {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-[#ff8080]">{error}</p>}

              {/* Submit */}
              <div className="flex flex-col-reverse items-stretch gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
                <p className="flex flex-1 items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  {editId ? t.publish.footerEdit : t.publish.footerNew}
                </p>
                <Button
                  onClick={submit}
                  disabled={saving || uploading}
                  className="shrink-0 gap-2 px-6 font-bold neon-shadow"
                >
                  <Zap className="h-4 w-4" strokeWidth={2.5} />
                  {editId
                    ? saving
                      ? t.publish.saving
                      : t.publish.saveChanges
                    : saving
                      ? t.publish.publishing
                      : uploading
                        ? t.publish.uploadingImage
                        : t.publish.publishPts(rules.points_launch)}
                </Button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer (sticky bottom via mt-auto) */}
      <footer className="mt-auto border-t border-white/10 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto flex max-w-[1800px] flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            <span className="font-machina font-bold uppercase tracking-[0.08em] text-foreground">Cabal</span> ·{' '}
            {t.appFooter.tagline}
          </p>
          <p className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-primary/70" aria-hidden />{' '}
            {t.appFooter.points(rules.points_thesis, rules.points_launch)}
          </p>
        </div>
      </footer>
    </div>
  )
}

/** Estado de éxito tras publicar el launch */
function SuccessPanel({
  earned,
  ticker,
  onReset,
  onGoRadar,
}: {
  earned: number
  ticker: string
  onReset: () => void
  onGoRadar: () => void
}) {
  const t = useT()
  return (
    <div className="card-surface flex flex-col items-center gap-4 rounded-2xl border border-white/10 px-6 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[#8FA83F]/40 bg-[#8FA83F]/10">
        <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden />
      </span>
      <div>
        <h2 className="font-machina text-xl font-bold uppercase tracking-wide">{t.publish.doneTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {ticker ? <span className="font-bold text-foreground">${ticker}</span> : t.publish.yourLaunch}
          {t.publish.doneBody}
        </p>
      </div>
      <p className="flex items-center gap-1.5 rounded-full border border-[#8FA83F]/25 bg-[#8FA83F]/8 px-3.5 py-1.5 text-sm font-bold text-primary">
        <Zap className="h-4 w-4" aria-hidden /> {t.publish.earnedPoints(earned)}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
        <Button onClick={onGoRadar} className="px-5 font-bold">
          <Radar className="h-4 w-4" aria-hidden /> {t.publish.seeInRadar}
        </Button>
        <Button onClick={onReset} variant="outline" className="border-white/15 bg-transparent px-5 font-bold hover:bg-white/5">
          {t.publish.publishAnother}
        </Button>
      </div>
    </div>
  )
}

/** Opción excluyente del selector "¿Quién publica este launch?" (dev / comunidad) */
function RoleOption({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all active:scale-[0.99]',
        active
          ? 'border-[#8FA83F]/60 bg-[#8FA83F]/8'
          : 'border-white/10 bg-[#0a0b08] hover:border-white/25'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
          active
            ? 'border-[#8FA83F]/40 bg-[#8FA83F]/15 text-primary'
            : 'border-white/10 bg-white/5 text-muted-foreground'
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[13px] font-bold', active && 'text-primary')}>{title}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}
