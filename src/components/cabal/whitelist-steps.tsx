'use client'

import { useEffect, useState } from 'react'
import { CabalWordmark } from '@/components/cabal/shared'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Languages,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { jsonFetch, qk } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { XLogo } from '@/components/cabal/x-logo'
import { FollowXCampaign } from '@/components/cabal/follow-x-campaign'
import type { Locale, WaitlistStatusDTO } from '@/lib/waitlist'
import {
  canCopyImages,
  copyImage,
  downloadImage,
  fetchCardFile,
  prefersNativeShare,
  shareNative,
} from '@/lib/share-image'

/**
 * Pasos 2 y 3 de la lista de espera, en su propia página (/whitelist): datos
 * básicos y, una vez dentro, la tarjeta para compartir en X. El paso 1 (el
 * login con X) vive en la home y trae aquí al usuario ya autenticado.
 */

const ERRORS: Record<string, string> = {
  access_denied: 'Cancelaste la autorización en X',
  state: 'La sesión expiró, vuelve a intentarlo',
  token: 'X rechazó el intercambio del código',
  profile: 'No se pudo leer tu perfil de X',
  no_config: 'El acceso con X aún no está configurado',
  server: 'Error inesperado, inténtalo de nuevo',
}

export function WhitelistSteps() {
  const t = useT()
  const qc = useQueryClient()
  const status = useQuery<WaitlistStatusDTO>({
    queryKey: qk.waitlistMe,
    queryFn: () => jsonFetch('/api/waitlist/me'),
  })

  const [justConnected] = useState(() => {
    if (typeof window === 'undefined') return { ok: false, error: null as string | null }
    const sp = new URLSearchParams(window.location.search)
    const ok = sp.get('wl') === 'ok'
    const error = sp.get('wl_error')
    if (ok || error) window.history.replaceState(null, '', window.location.pathname)
    return { ok, error }
  })

  useEffect(() => {
    if (justConnected.error) {
      toast.error(ERRORS[justConnected.error] ?? t.landing.errors.generic)
    } else if (justConnected.ok) {
      toast.success(t.waitlist.connected, { description: t.waitlist.connectedBody })
    }
  }, [justConnected])

  const data = status.data

  return (
    <div className="min-h-screen bg-[#0a0b08] text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] opacity-60"
        style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(143,168,63,0.16) 0%, transparent 70%)' }}
      />

      <div className="relative mx-auto w-full max-w-xl px-4 py-8 sm:px-6 md:py-12">
        <header className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5 outline-none">
            <CabalWordmark />
          </Link>
          <Link
            href="/"
            className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Volver
          </Link>
        </header>

        <div className="mt-8">
          {status.isPending || !data ? (
            <Skeleton className="h-[460px] w-full rounded-2xl" />
          ) : data.step === 'login' ? (
            <NeedsLogin />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121410] shadow-[0_0_60px_rgba(143,168,63,0.07)]">
              <Steps current={data.step} />
              <div className="p-6">
                {data.step === 'form' ? (
                  <StepForm status={data} onDone={() => qc.invalidateQueries({ queryKey: qk.waitlistMe })} />
                ) : (
                  <StepShare status={data} onDone={() => qc.invalidateQueries({ queryKey: qk.waitlistMe })} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Alguien llegó a /whitelist sin haber pasado por X: lo devolvemos al paso 1. */
function NeedsLogin() {
  const t = useT()
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121410] p-6 text-center">
      <h1 className="font-display text-xl font-bold">{t.waitlist.needsLoginTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.waitlist.needsLoginBody}</p>
      <Button
        asChild
        className="animate-cta-glow mt-6 w-full gap-2 text-[15px] font-bold"
      >
        <a href="/api/waitlist/x/start">
          <XLogo className="h-4 w-4" /> {t.landing.cta.login}
        </a>
      </Button>
    </div>
  )
}

const STEP_KEYS: WaitlistStatusDTO['step'][] = ['login', 'form', 'done']

function Steps({ current }: { current: WaitlistStatusDTO['step'] }) {
  const t = useT()
  const index = STEP_KEYS.findIndex((key) => key === current)
  return (
    <ol className="flex border-b border-white/10 bg-[#0a0b08]">
      {STEP_KEYS.map((key, i) => (
        <li
          key={key}
          aria-current={i === index ? 'step' : undefined}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 px-2 py-3 text-[12px] font-bold',
            i === index ? 'text-primary' : i < index ? 'text-muted-foreground' : 'text-muted-foreground/50'
          )}
        >
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full border text-[10px]',
              i === index
                ? 'border-primary bg-[#8FA83F]/15'
                : i < index
                  ? 'border-primary/40 text-primary'
                  : 'border-white/15'
            )}
          >
            {i < index ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : i + 1}
          </span>
          {t.waitlist.steps[key]}
        </li>
      ))}
    </ol>
  )
}

// --- Paso 2: datos básicos (nombre y @handle vienen de la API de X) ---
function StepForm({ status, onDone }: { status: WaitlistStatusDTO; onDone: () => void }) {
  const t = useT()
  const e = status.entry!
  const [form, setForm] = useState({
    name: e.xName || e.xHandle,
    email: e.email,
    telegram: e.telegram,
    wallet: e.wallet,
    country: e.country,
    reason: e.reason,
  })
  const set = (k: keyof typeof form) => (ev: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: ev.target.value }))

  const submit = useMutation({
    mutationFn: (data: typeof form) =>
      jsonFetch<{ ok: boolean }>('/api/waitlist/register', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success(t.waitlist.onList)
      onDone()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault()
        submit.mutate(form)
      }}
    >
      <h1 className="font-display text-xl font-bold">{t.waitlist.formTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.waitlist.formLead}</p>

      {/* Identidad traída de X: no editable */}
      <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#8FA83F]/30 bg-[#8FA83F]/[0.08] p-3">
        {e.xAvatar ? (
          <img src={e.xAvatar} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0a0b08] text-lg">🐺</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">@{e.xHandle}</p>
          <p className="text-[11px] text-muted-foreground">{t.waitlist.followers(e.xFollowers.toLocaleString())}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-[#8FA83F]/40 bg-[#8FA83F]/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
          <BadgeCheck className="h-3 w-3" aria-hidden /> {t.waitlist.verified}
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        <Field label={t.waitlist.name} hint={t.waitlist.nameHint}>
          <Input
            value={form.name}
            onChange={set('name')}
            maxLength={60}
            required
            className="h-11 border-white/10 bg-[#0a0b08]"
          />
        </Field>

        <Field label={t.waitlist.email} hint={t.waitlist.emailHint}>
          <Input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder={t.waitlist.emailPlaceholder}
            maxLength={120}
            required
            className="h-11 border-white/10 bg-[#0a0b08]"
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label={t.waitlist.telegram} optional>
            <Input
              value={form.telegram}
              onChange={set('telegram')}
              placeholder={t.waitlist.telegramPlaceholder}
              maxLength={40}
              className="h-11 border-white/10 bg-[#0a0b08]"
            />
          </Field>
          <Field label={t.waitlist.country} optional>
            <Input
              value={form.country}
              onChange={set('country')}
              placeholder={t.waitlist.countryPlaceholder}
              maxLength={60}
              className="h-11 border-white/10 bg-[#0a0b08]"
            />
          </Field>
        </div>

        <Field label={t.waitlist.wallet} optional hint={t.waitlist.walletHint}>
          <Input
            value={form.wallet}
            onChange={set('wallet')}
            placeholder={t.waitlist.walletPlaceholder}
            maxLength={80}
            className="h-11 border-white/10 bg-[#0a0b08] font-mono text-base sm:text-xs"
          />
        </Field>

        <Field label={t.waitlist.why} optional hint={t.waitlist.whyHint}>
          <Textarea
            value={form.reason}
            onChange={set('reason')}
            maxLength={300}
            rows={3}
            placeholder={t.waitlist.whyPlaceholder}
            className="resize-none border-white/10 bg-[#0a0b08] text-base sm:text-sm"
          />
        </Field>
      </div>

      <Button
        type="submit"
        disabled={submit.isPending}
        className="mt-5 w-full gap-2 text-[15px] font-bold"
      >
        {submit.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden />
        )}
        {t.waitlist.confirm}
      </Button>

      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Zap className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        {t.waitlist.confirmHint}
      </p>
    </form>
  )
}

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string
  hint?: string
  optional?: boolean
  children: React.ReactNode
}) {
  const t = useT()
  return (
    <div className="space-y-1.5">
      <Label className="flex items-baseline gap-1.5 text-[13px] font-semibold">
        {label}
        {optional && <span className="text-[11px] font-normal text-muted-foreground">{t.waitlist.optional}</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

// --- Paso 3: compartir la tarjeta en X ---
function StepShare({ status, onDone }: { status: WaitlistStatusDTO; onDone: () => void }) {
  const t = useT()
  const e = status.entry!
  // Arranca en el idioma detectado por el navegador y se puede cambiar a mano:
  // ambas variantes ya vienen en la respuesta, así que el cambio es inmediato.
  const [locale, setLocale] = useState<Locale>(status.locale)
  const post = status.share[locale]
  const other: Locale = locale === 'es' ? 'en' : 'es'

  // Capacidades del navegador. Se leen tras montar porque en el servidor no
  // existen y leerlas durante el render descuadraría la hidratación.
  const [nativeShare, setNativeShare] = useState(false)
  const [copyable, setCopyable] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => {
      setNativeShare(prefersNativeShare())
      setCopyable(canCopyImages())
    }, 0)
    return () => clearTimeout(t)
  }, [])

  // La imagen se descarga por adelantado. Compartir y copiar tienen que ocurrir
  // dentro del gesto del usuario, y Safari lo da por perdido si antes de llamar
  // al navegador hay que esperar a una descarga. Se guarda junto a su URL para
  // que al cambiar de idioma no se use la del otro mientras llega la nueva.
  const [loaded, setLoaded] = useState<{ url: string; file: File } | null>(null)
  const cardFile = loaded?.url === post.card ? loaded.file : null
  useEffect(() => {
    let alive = true
    fetchCardFile(post.card, e.xHandle)
      .then((file) => alive && setLoaded({ url: post.card, file }))
      .catch(() => {}) // sin imagen se sigue pudiendo compartir el enlace
    return () => {
      alive = false
    }
  }, [post.card, e.xHandle])

  const [copiedFor, setCopiedFor] = useState<string | null>(null)
  const copied = copiedFor === post.card

  const markShared = useMutation({
    mutationFn: () =>
      jsonFetch<{ ok: boolean; pointsEarned: number }>('/api/waitlist/shared', { method: 'POST' }),
    onSuccess: (res) => {
      if (res.pointsEarned > 0) {
        toast.success(t.waitlist.firstPoints(res.pointsEarned), {
          description: t.waitlist.firstPointsBody,
        })
      }
      onDone()
    },
  })

  const approved = e.status === 'approved'

  const ctaClass = cn(
    'mt-4 h-12 w-full gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground hover:bg-[#9dba46]',
    !e.shared && 'animate-cta-glow'
  )
  const ctaLabel = (
    <>
      <Send className="h-4 w-4" aria-hidden /> {t.waitlist.shareOnX}
      {!e.shared && <span className="font-mono">+{status.shareBonus}</span>}
    </>
  )

  /** Móvil: la imagen y el texto van juntos a la app de X. */
  const shareFromDevice = async () => {
    if (!cardFile) return
    try {
      const done = await shareNative(cardFile, `${post.text}\n\n${post.url}`)
      if (done && !e.shared) markShared.mutate()
    } catch {
      // Si el panel del sistema falla, el intent de siempre: al menos sale el texto
      window.open(post.intent, '_blank', 'noopener,noreferrer')
      if (!e.shared) markShared.mutate()
    }
  }

  /** Escritorio: se copia para pegarla con Ctrl+V en el compositor de X. */
  const copyCard = async () => {
    if (!cardFile) return
    try {
      await copyImage(cardFile)
      setCopiedFor(post.card)
      toast.success(t.waitlist.imageCopied, {
        description: t.waitlist.imageCopiedBody,
      })
    } catch {
      toast.error(t.waitlist.imageCopyFailed, {
        description: t.waitlist.imageCopyFailedBody,
      })
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
        <h1 className="font-display text-xl font-bold">{t.waitlist.inTitle(e.xHandle)}</h1>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] p-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t.waitlist.position}</p>
          <p className="font-machina text-3xl font-bold text-primary">#{e.position}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t.waitlist.status}</p>
          <p className={cn('text-sm font-bold', approved ? 'text-primary' : 'text-foreground')}>
            {approved ? t.waitlist.approved : t.waitlist.notApproved}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {approved ? t.waitlist.approvedBody : t.waitlist.notApprovedBody}
      </p>

      {approved && (
        <Button asChild className="animate-cta-glow mt-3 w-full gap-2 text-[15px] font-bold">
          <Link href="/app">{t.waitlist.enterApp}</Link>
        </Button>
      )}

      {/* Recompensa por difundir */}
      {!e.shared && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#8FA83F]/40 bg-[#8FA83F]/10 p-4">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-[14px] font-bold text-primary">{t.waitlist.earnFirst(status.shareBonus)}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              {t.waitlist.earnFirstBody(status.shareBonus)}
            </p>
          </div>
        </div>
      )}

      {/* Vista previa del post, tal y como se verá en X */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0a0b08]">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t.waitlist.yourPost}</p>
            <button
              type="button"
              onClick={() => setLocale(other)}
              className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Languages className="h-3 w-3" aria-hidden />
              {other === 'en' ? 'English' : 'Español'}
            </button>
          </div>
          <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed">{post.text}</p>
          <p className="mt-2 truncate text-[13px] text-primary">{post.url}</p>
        </div>
        <img
          key={post.card}
          src={post.card}
          alt={t.waitlist.cardAlt(e.xHandle)}
          width={1672}
          height={941}
          className="w-full border-t border-white/10"
          loading="lazy"
        />
        {/* X no adjunta la imagen desde el intent; en escritorio se ofrece
            copiarla o descargarla. En movil no hace falta: se adjunta sola. */}
        {!nativeShare && (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-white/10 px-4 py-2 text-[11px] text-muted-foreground">
            <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
            <span>{t.waitlist.attachHint}</span>
            {copyable && (
              <>
                <button
                  type="button"
                  onClick={copyCard}
                  disabled={!cardFile}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
                  {copied ? t.post.copied : t.post.copy}
                </button>
                <span aria-hidden>·</span>
              </>
            )}
            <button
              type="button"
              onClick={() => cardFile && downloadImage(cardFile)}
              disabled={!cardFile}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <Download className="h-3 w-3" aria-hidden />
              {t.post.download}
            </button>
          </p>
        )}
      </div>

      {nativeShare && cardFile ? (
        <Button onClick={shareFromDevice} className={ctaClass}>
          {ctaLabel}
        </Button>
      ) : (
        <Button asChild onClick={() => !e.shared && markShared.mutate()} className={ctaClass}>
          <a href={post.intent} target="_blank" rel="noopener noreferrer">
            {ctaLabel}
          </a>
        </Button>
      )}

      {e.shared && (
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[12px] text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {t.waitlist.thanks(status.shareBonus)}
        </p>
      )}

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        {t.waitlist.affiliateNote} <span className="font-bold text-primary">10%</span> {t.waitlist.affiliateNote2}
      </p>

      {/* Campaña de X: aquí es donde está la gente antes del lanzamiento, así que
          los puntos por seguir la cuenta se cobran sin tener que entrar a la app.
          El alta de la whitelist ya deja la sesión de Cabal puesta (ver el
          callback de /api/waitlist/x), que es lo que /api/me/follow-x necesita. */}
      <FollowXCampaign className="mt-5 text-left" />
    </div>
  )
}
