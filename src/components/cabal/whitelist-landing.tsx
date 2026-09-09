'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Eye,
  Gift,
  Lock,
  Radar,
  ShieldCheck,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { jsonFetch, qk } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { XLogo } from '@/components/cabal/x-logo'
import type { WaitlistStatusDTO } from '@/lib/waitlist'

/**
 * Home pública de cabal.army: hero con el radar animado de fondo y un único
 * llamado a la acción, "Acceso con X". El registro continúa en /whitelist
 * (datos + tarjeta para compartir), para que esta página no pida más de una
 * decisión al visitante.
 */

const BENEFITS = [
  {
    icon: Radar,
    title: 'Los launches, antes de que salgan',
    body: 'El radar de Cabal recoge lanzamientos que la comunidad publica con fecha y hora. Llegas al minuto cero, no cuando ya está en todos los grupos.',
  },
  {
    icon: ShieldCheck,
    title: 'Historial real de cada dev',
    body: 'Cada token queda ligado a la wallet que lo lanzó, con métricas on-chain verificadas: máximo histórico, liquidez bloqueada, mint revocado y rugs anteriores.',
  },
  {
    icon: Trophy,
    title: 'Puntos que se canjean por $CABAL',
    body: 'Publicas una tesis, aciertas un call, aportas información: sumas puntos Cabal. Los puntos del periodo previo al lanzamiento cuentan doble.',
  },
  {
    icon: Users,
    title: 'Una comunidad cerrada, no un grupo de señales',
    body: 'Tesis argumentadas, debate público y reputación acumulada. Quien acierta sube en la tabla; quien inventa, se queda sin credibilidad.',
  },
  {
    icon: Eye,
    title: 'Transmisiones en vivo del lanzamiento',
    body: 'Los devs presentan su proyecto en directo desde la ficha del launch. Preguntas en tiempo real antes de poner un solo dólar.',
  },
  {
    icon: Gift,
    title: 'Ventajas de fundador',
    body: 'Quien entra por la lista de espera conserva su plaza, su @handle y una insignia de miembro fundador cuando abramos al público.',
  },
]

const ERRORS: Record<string, string> = {
  access_denied: 'Cancelaste la autorización en X',
  state: 'La sesión expiró, vuelve a intentarlo',
  token: 'X rechazó el intercambio del código',
  profile: 'No se pudo leer tu perfil de X',
  no_config: 'El acceso con X aún no está configurado',
  server: 'Error inesperado, inténtalo de nuevo',
}

export function WhitelistLanding() {
  const status = useQuery<WaitlistStatusDTO>({
    queryKey: qk.waitlistMe,
    queryFn: () => jsonFetch('/api/waitlist/me'),
  })

  // ?ref= (invitación) y ?wl_error= (vuelta fallida del OAuth), leídos una vez
  const [params] = useState(() => {
    if (typeof window === 'undefined') return { ref: null as string | null, error: null as string | null }
    const sp = new URLSearchParams(window.location.search)
    const ref = sp.get('ref')
    const error = sp.get('wl_error')
    if (error) {
      window.history.replaceState(null, '', `${window.location.pathname}${ref ? `?ref=${ref}` : ''}`)
    }
    return { ref, error }
  })

  useEffect(() => {
    if (params.error) toast.error(ERRORS[params.error] ?? 'No se pudo completar el registro')
  }, [params])

  const data = status.data
  // Quien ya pasó por X vuelve a su paso pendiente en vez de repetir el login
  const pending = Boolean(data && data.step !== 'login')

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0b08] text-foreground">
      <div className="relative">
        <RadarBackdrop />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
          <header className="flex items-center gap-2.5">
            <Image src="/cabal-logo.png" alt="" width={36} height={36} className="rounded-lg" priority />
            <span className="font-machina text-lg font-bold uppercase tracking-[0.08em]">Cabal</span>
            <span className="ml-auto rounded-full border border-[#8FA83F]/40 bg-[#8FA83F]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
              Acceso anticipado
            </span>
          </header>

          <div className="mt-12 grid items-center gap-12 md:mt-16 lg:grid-cols-[1.02fr_0.98fr]">
            <Hero
              total={data?.total ?? 0}
              loading={status.isPending}
              configured={data?.configured ?? true}
              refHandle={params.ref}
              pending={pending}
            />
            <Mockup />
          </div>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <section className="mt-10 md:mt-16">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Por qué merece la pena entrar <span className="text-primary">antes</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Cabal no es otro grupo de señales. Es el registro público de quién lanzó qué, quién lo vio venir y quién se
            equivocó.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <article
                key={b.title}
                className="rounded-2xl border border-white/10 bg-[#121410] p-5 transition-colors hover:border-[#8FA83F]/40"
              >
                <b.icon className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-display text-[15px] font-bold">{b.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{b.body}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-14 border-t border-white/10 pt-6 text-xs text-muted-foreground">
          <p>
            <span className="font-machina font-bold uppercase tracking-[0.08em] text-foreground">Cabal</span> · cabal.army —
            la comunidad que ve los launches antes que nadie.
          </p>
          <p className="mt-1.5">
            Solo pedimos tu cuenta de X para verificar que eres una persona real y reservar tu @handle. Nada de esto es
            consejo financiero.
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/terminos" className="hover:text-foreground">
              Términos de Servicio
            </Link>
            <Link href="/privacidad" className="hover:text-foreground">
              Política de Privacidad
            </Link>
            <a href="mailto:legal@cabal.army" className="hover:text-foreground">
              legal@cabal.army
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

// ---------------- Radar animado de fondo ----------------
/**
 * El logo de Cabal a escala gigante detrás del hero: anillos concéntricos,
 * ecos que se expanden, contactos que parpadean y la aguja girando. Va
 * difuminado y a baja opacidad para que el texto siga mandando.
 */
function RadarBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Resplandor superior */}
      <div
        className="absolute inset-x-0 top-0 h-[560px]"
        style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(143,168,63,0.16) 0%, transparent 70%)' }}
      />

      <div className="absolute left-1/2 top-1/2 h-[780px] w-[780px] -translate-x-1/2 -translate-y-1/2 opacity-60 blur-[2px] sm:h-[920px] sm:w-[920px] lg:left-auto lg:right-[-120px] lg:translate-x-0">
        <svg viewBox="0 0 400 400" className="h-full w-full">
          <defs>
            <radialGradient id="radar-fade" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8FA83F" stopOpacity="0.18" />
              <stop offset="70%" stopColor="#8FA83F" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#8FA83F" stopOpacity="0" />
            </radialGradient>
            {/* La aguja: un sector que se desvanece por detrás, como un barrido real */}
            <linearGradient id="radar-beam" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8FA83F" stopOpacity="0.40" />
              <stop offset="100%" stopColor="#8FA83F" stopOpacity="0" />
            </linearGradient>
          </defs>

          <circle cx="200" cy="200" r="190" fill="url(#radar-fade)" />

          {/* Anillos y retícula */}
          {[60, 105, 150, 190].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="#8FA83F" strokeOpacity="0.16" strokeWidth="1.5" />
          ))}
          <line x1="10" y1="200" x2="390" y2="200" stroke="#8FA83F" strokeOpacity="0.1" strokeWidth="1" />
          <line x1="200" y1="10" x2="200" y2="390" stroke="#8FA83F" strokeOpacity="0.1" strokeWidth="1" />

          {/* Ecos que se expanden desde el centro */}
          <circle cx="200" cy="200" r="190" fill="none" stroke="#8FA83F" strokeWidth="2" className="animate-radar-ping" />
          <circle
            cx="200"
            cy="200"
            r="190"
            fill="none"
            stroke="#8FA83F"
            strokeWidth="2"
            className="animate-radar-ping"
            style={{ animationDelay: '2s' }}
          />

          {/* Contactos detectados */}
          {[
            { x: 268, y: 148 },
            { x: 142, y: 254 },
            { x: 236, y: 268 },
            { x: 118, y: 168 },
            { x: 300, y: 226 },
          ].map((p, i) => (
            <circle
              key={`${p.x}-${p.y}`}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#8FA83F"
              className="animate-radar-blip"
              style={{ animationDelay: `${i * 0.8}s` }}
            />
          ))}

          {/* Aguja girando */}
          <g className="animate-radar-sweep">
            <path d="M200 200 L390 200 A190 190 0 0 0 335 66 Z" fill="url(#radar-beam)" />
            <line x1="200" y1="200" x2="390" y2="200" stroke="#8FA83F" strokeOpacity="0.55" strokeWidth="2" />
          </g>

          <circle cx="200" cy="200" r="13" fill="#8FA83F" fillOpacity="0.5" />
        </svg>
      </div>

      {/* Funde el radar hacia abajo para que no compita con el contenido */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0a0b08]" />
    </div>
  )
}

// ---------------- Hero ----------------
function Hero({
  total,
  loading,
  configured,
  refHandle,
  pending,
}: {
  total: number
  loading: boolean
  configured: boolean
  refHandle: string | null
  pending: boolean
}) {
  return (
    <div>
      <h1 className="font-machina text-4xl font-bold leading-[1.05] sm:text-5xl md:text-6xl">
        Entra al radar
        <br />
        <span className="text-primary">antes que el resto</span>
      </h1>
      <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
        Cabal abre por invitación. Apúntate a la lista de espera con tu cuenta de X, reserva tu plaza y tu @handle, y sé de
        los primeros en ver los lanzamientos cuando abramos.
      </p>

      {refHandle && (
        <p className="mt-5 inline-flex rounded-xl border border-[#8FA83F]/30 bg-[#8FA83F]/10 px-3.5 py-2 text-[13px]">
          Te invitó <span className="ml-1 font-bold text-primary">@{refHandle}</span>
        </p>
      )}

      {/* Llamado a la acción principal */}
      <div className="mt-8">
        <CtaButton configured={configured} refHandle={refHandle} pending={pending} />
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Zap className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          Gana 10 puntos Cabal al compartir tu tarjeta después de registrarte
        </p>
        {!configured && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Falta definir X_CLIENT_ID y X_CLIENT_SECRET en el servidor.
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2.5">
        <Stat label="Ya en la lista" value={loading ? '—' : total.toLocaleString('es')} highlight />
        <Stat label="Plazas de la primera tanda" value="500" />
        <Stat label="Coste" value="Gratis" />
      </div>

      <ul className="mt-7 space-y-2.5">
        {[
          { icon: BadgeCheck, text: 'Verificación con tu cuenta real de X: sin bots, sin cuentas duplicadas.' },
          { icon: Lock, text: 'No pedimos permiso para publicar ni acceso a tus mensajes.' },
          { icon: CheckCircle2, text: 'Tu @handle queda reservado hasta el día del lanzamiento.' },
        ].map((t) => (
          <li key={t.text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Botón principal: pulso de luz y un brillo que lo recorre. */
function CtaButton({
  configured,
  refHandle,
  pending,
}: {
  configured: boolean
  refHandle: string | null
  pending: boolean
}) {
  const startHref = `/api/waitlist/x/start${refHandle ? `?ref=${encodeURIComponent(refHandle)}` : ''}`
  const classes =
    'group animate-cta-glow relative inline-flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-primary px-8 text-[16px] font-bold text-primary-foreground transition-transform hover:scale-[1.02] hover:bg-[#9dba46] sm:w-auto'

  // Quien ya conectó X continúa donde lo dejó
  if (pending) {
    return (
      <Button asChild className={classes}>
        <Link href="/whitelist">
          <Shine />
          Continuar mi registro
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </Button>
    )
  }

  if (!configured) {
    return (
      <Button disabled className={cn(classes, 'animate-none opacity-70')}>
        <XLogo className="h-5 w-5" /> Acceso con X no disponible
      </Button>
    )
  }

  return (
    <Button asChild className={classes}>
      <a href={startHref}>
        <Shine />
        <XLogo className="h-5 w-5" />
        Acceso con X
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </a>
    </Button>
  )
}

function Shine() {
  return (
    <span
      aria-hidden
      className="animate-cta-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/25 blur-md"
    />
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-2.5 backdrop-blur-sm',
        highlight ? 'border-[#8FA83F]/40 bg-[#8FA83F]/10' : 'border-white/10 bg-[#121410]/80'
      )}
    >
      <p className={cn('font-machina text-xl font-bold', highlight && 'text-primary')}>{value}</p>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  )
}

// ---------------- Mockup ----------------
/**
 * El escuadron de Cabal sobre un marco de impacto que deriva despacio por
 * detras. El marco va en su propia capa para poder moverlo sin arrastrar al
 * escuadron, que se mantiene quieto y nitido.
 */
function Mockup() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:mx-0">
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[40px] opacity-70 blur-2xl"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(143,168,63,0.22) 0%, transparent 70%)' }}
      />

      <div className="relative aspect-[594/393]">
        <div aria-hidden className="absolute -inset-[7%]">
          <Image
            src="/home-mockup-bg.webp"
            alt=""
            fill
            className="animate-mockup-drift object-contain opacity-80"
            sizes="(max-width: 1024px) 95vw, 560px"
          />
        </div>

        <Image
          src="/home-squad.webp"
          alt="El escuadron de Cabal: la comunidad que lanza y respalda proyectos."
          fill
          priority
          className="animate-squad-sway relative object-contain drop-shadow-[0_20px_45px_rgba(0,0,0,0.55)]"
          sizes="(max-width: 1024px) 90vw, 520px"
        />
      </div>

      <p className="relative mt-6 text-center text-[12px] text-muted-foreground">
        Al registrarte generamos <span className="font-bold text-primary">tu tarjeta</span> con tu foto y tu @usuario,
        lista para publicar en X.
      </p>
    </div>
  )
}
