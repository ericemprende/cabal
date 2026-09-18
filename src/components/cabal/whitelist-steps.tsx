'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
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
      toast.error(ERRORS[justConnected.error] ?? 'No se pudo completar el registro')
    } else if (justConnected.ok) {
      toast.success('Cuenta de X conectada', { description: 'Completa tus datos para entrar en la lista' })
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
            <Image src="/cabal-logo.png" alt="" width={32} height={32} className="rounded-lg" priority />
            <span className="font-machina text-base font-bold uppercase tracking-[0.08em]">Cabal</span>
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
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121410] p-6 text-center">
      <h1 className="font-display text-xl font-bold">Primero conecta tu cuenta de X</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        La lista de espera empieza verificando tu identidad en X. Solo te toma un clic.
      </p>
      <Button
        asChild
        className="animate-cta-glow mt-6 h-12 w-full gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground hover:bg-[#9dba46]"
      >
        <a href="/api/waitlist/x/start">
          <XLogo className="h-4 w-4" /> Acceso con X
        </a>
      </Button>
    </div>
  )
}

const STEP_LABELS: { key: WaitlistStatusDTO['step']; label: string }[] = [
  { key: 'login', label: 'Conecta X' },
  { key: 'form', label: 'Tus datos' },
  { key: 'done', label: 'Comparte' },
]

function Steps({ current }: { current: WaitlistStatusDTO['step'] }) {
  const index = STEP_LABELS.findIndex((s) => s.key === current)
  return (
    <ol className="flex border-b border-white/10 bg-[#0a0b08]">
      {STEP_LABELS.map((s, i) => (
        <li
          key={s.key}
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
          {s.label}
        </li>
      ))}
    </ol>
  )
}

// --- Paso 2: datos básicos (nombre y @handle vienen de la API de X) ---
function StepForm({ status, onDone }: { status: WaitlistStatusDTO; onDone: () => void }) {
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
      toast.success('¡Estás en la lista de espera!')
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
      <h1 className="font-display text-xl font-bold">Completa tus datos</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tu cuenta de X ya está verificada. Solo falta un email para avisarte cuando abramos tu acceso.
      </p>

      {/* Identidad traída de X: no editable */}
      <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#8FA83F]/30 bg-[#8FA83F]/[0.08] p-3">
        {e.xAvatar ? (
          <img src={e.xAvatar} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0a0b08] text-lg">🐺</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">@{e.xHandle}</p>
          <p className="text-[11px] text-muted-foreground">{e.xFollowers.toLocaleString('es')} seguidores en X</p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-[#8FA83F]/40 bg-[#8FA83F]/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
          <BadgeCheck className="h-3 w-3" aria-hidden /> Verificado
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        <Field label="Nombre" hint="Precargado desde tu perfil de X">
          <Input
            value={form.name}
            onChange={set('name')}
            maxLength={60}
            required
            className="h-11 border-white/10 bg-[#0a0b08]"
          />
        </Field>

        <Field label="Email" hint="X no nos lo facilita, escríbelo tú">
          <Input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="tu@email.com"
            maxLength={120}
            required
            className="h-11 border-white/10 bg-[#0a0b08]"
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Telegram" optional>
            <Input
              value={form.telegram}
              onChange={set('telegram')}
              placeholder="@usuario"
              maxLength={40}
              className="h-11 border-white/10 bg-[#0a0b08]"
            />
          </Field>
          <Field label="País" optional>
            <Input
              value={form.country}
              onChange={set('country')}
              placeholder="España"
              maxLength={60}
              className="h-11 border-white/10 bg-[#0a0b08]"
            />
          </Field>
        </div>

        <Field label="Wallet" optional hint="Solana o EVM, para los airdrops de $CABAL">
          <Input
            value={form.wallet}
            onChange={set('wallet')}
            placeholder="Dirección pública"
            maxLength={80}
            className="h-11 border-white/10 bg-[#0a0b08] font-mono text-xs"
          />
        </Field>

        <Field label="¿Por qué quieres entrar?" optional hint="Nos ayuda a priorizar tu solicitud">
          <Textarea
            value={form.reason}
            onChange={set('reason')}
            maxLength={300}
            rows={3}
            placeholder="Tradeo memecoins en Solana desde 2023, publico análisis en X…"
            className="resize-none border-white/10 bg-[#0a0b08] text-sm"
          />
        </Field>
      </div>

      <Button
        type="submit"
        disabled={submit.isPending}
        className="mt-5 h-12 w-full gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground hover:bg-[#8FA83F]"
      >
        {submit.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden />
        )}
        Confirmar datos
      </Button>

      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Zap className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        Después podrás ganar tus primeros 10 puntos compartiendo tu tarjeta en X
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
  return (
    <div className="space-y-1.5">
      <Label className="flex items-baseline gap-1.5 text-[13px] font-semibold">
        {label}
        {optional && <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

// --- Paso 3: compartir la tarjeta en X ---
function StepShare({ status, onDone }: { status: WaitlistStatusDTO; onDone: () => void }) {
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
        toast.success(`+${res.pointsEarned} puntos Cabal`, {
          description: 'Tus primeros puntos por difundir el escuadrón',
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
      <Send className="h-4 w-4" aria-hidden /> Compartir en X
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
      toast.success('Imagen copiada', {
        description: 'Ahora pulsa Compartir en X y pégala con Ctrl+V (⌘V en Mac).',
      })
    } catch {
      toast.error('Tu navegador no dejó copiar la imagen', {
        description: 'Descárgala y adjúntala desde el botón de imagen de X.',
      })
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
        <h1 className="font-display text-xl font-bold">Ya estás dentro, @{e.xHandle}</h1>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] p-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Tu posición</p>
          <p className="font-machina text-3xl font-bold text-primary">#{e.position}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Estado</p>
          <p className={cn('text-sm font-bold', approved ? 'text-primary' : 'text-foreground')}>
            {approved ? 'Acceso habilitado' : 'No aprobada'}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {approved
          ? 'Tu acceso está habilitado: ya puedes entrar a la app.'
          : 'Tu solicitud no fue aprobada.'}
      </p>

      {approved && (
        <Button asChild className="animate-cta-glow mt-3 h-12 w-full gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground hover:bg-[#9dba46]">
          <Link href="/app">Entrar a la app</Link>
        </Button>
      )}

      {/* Recompensa por difundir */}
      {!e.shared && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#8FA83F]/40 bg-[#8FA83F]/10 p-4">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-[14px] font-bold text-primary">Gana tus primeros {status.shareBonus} puntos</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              Avísale al mundo que haces parte de Cabal Army: comparte tu tarjeta en X y se te abonan{' '}
              {status.shareBonus} puntos Cabal al instante.
            </p>
          </div>
        </div>
      )}

      {/* Vista previa del post, tal y como se verá en X */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0a0b08]">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tu post</p>
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
          alt={`Tarjeta de @${e.xHandle} para compartir en X`}
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
            <span>Para que la imagen salga siempre, adjúntala al post:</span>
            {copyable && (
              <>
                <button
                  type="button"
                  onClick={copyCard}
                  disabled={!cardFile}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
                  {copied ? 'Copiada' : 'Copiar'}
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
              Descargar
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
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> ¡Gracias por compartir! Ya tienes tus{' '}
          {status.shareBonus} puntos.
        </p>
      )}

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        Tu tarjeta lleva tu enlace de afiliado: quien se registre desde ella queda en tu equipo y te genera el{' '}
        <span className="font-bold text-primary">10%</span> de todos los puntos que consiga dentro de la plataforma.
      </p>

      {/* Campaña de X: aquí es donde está la gente antes del lanzamiento, así que
          los puntos por seguir la cuenta se cobran sin tener que entrar a la app.
          El alta de la whitelist ya deja la sesión de Cabal puesta (ver el
          callback de /api/waitlist/x), que es lo que /api/me/follow-x necesita. */}
      <FollowXCampaign className="mt-5 text-left" />
    </div>
  )
}
