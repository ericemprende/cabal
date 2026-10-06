'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CabalWordmark } from '@/components/cabal/shared'
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
import { CABAL_X_HANDLE, CABAL_X_URL } from '@/lib/cabal-x'
import { LangSwitch } from '@/components/cabal/lang-switch'
import { BotComparison } from '@/components/cabal/bot-comparison'
import { LaunchComparison } from '@/components/cabal/launch-comparison'
import { PlatformComparison } from '@/components/cabal/platform-comparison'
import { AllInOne } from '@/components/cabal/all-in-one'
import { INTRO_VIDEO_URL, IntroVideoPopup } from '@/components/cabal/intro-video-popup'
import { useLang } from '@/lib/i18n/provider'
import { baseLang } from '@/lib/i18n/config'
import { useT } from '@/lib/i18n/provider'
import type { Dict } from '@/lib/i18n/dictionaries'
import type { WaitlistStatusDTO } from '@/lib/waitlist'

/**
 * Home pública de cabal.army: hero con el radar animado de fondo y un único
 * llamado a la acción, "Acceso con X". El registro continúa en /whitelist
 * (datos + tarjeta para compartir), para que esta página no pida más de una
 * decisión al visitante.
 */

/** Los iconos van en el mismo orden que landing.benefits del diccionario. */
const BENEFIT_ICONS = [Radar, ShieldCheck, Trophy, Users, Eye, Gift]

type Shot = { src: string; w: number; h: number }

/**
 * Capturas reales de la app (public/landing) para cada beneficio, en el mismo
 * orden. La primera es la principal; la segunda flota por delante, desplazada.
 */
const BENEFIT_SHOTS: Shot[][] = [
  [
    { src: '/landing/launches-a.webp', w: 1276, h: 540 },
    { src: '/landing/launches-b.webp', w: 572, h: 650 },
  ],
  [
    { src: '/landing/dev-a.webp', w: 1280, h: 880 },
    { src: '/landing/dev-b.webp', w: 1280, h: 960 },
  ],
  [
    { src: '/landing/points-a.webp', w: 1276, h: 910 },
    { src: '/landing/points-b.webp', w: 572, h: 660 },
  ],
  [{ src: '/landing/community-a.webp', w: 900, h: 1280 }],
  [{ src: '/landing/live-a.webp', w: 1280, h: 825 }],
  [
    { src: '/landing/founder-a.webp', w: 1280, h: 624 },
    { src: '/landing/founder-b.webp', w: 1280, h: 880 },
  ],
]

/**
 * @param refHandle Quién invita. Lo pasa la ruta /r/<handle>; si no viene, se
 *   lee de ?ref=, que es el formato de los enlaces antiguos ya publicados.
 */
export function WhitelistLanding({ refHandle }: { refHandle?: string | null } = {}) {
  const t = useT()
  // Las tablas comparativas solo están en es/en: pt y de las ven en inglés.
  const lang = baseLang(useLang()[0])
  const status = useQuery<WaitlistStatusDTO>({
    queryKey: qk.waitlistMe,
    queryFn: () => jsonFetch('/api/waitlist/me'),
  })

  // Invitación y ?wl_error= (vuelta fallida del OAuth), leídos una vez
  const [params] = useState(() => {
    if (typeof window === 'undefined') {
      return { ref: refHandle ?? null, error: null as string | null }
    }
    const sp = new URLSearchParams(window.location.search)
    const ref = refHandle ?? sp.get('ref')
    const error = sp.get('wl_error')
    if (error) {
      // En /r/<handle> la invitación ya va en la ruta; solo la home necesita ?ref=
      const keep = ref && !refHandle ? `?ref=${ref}` : ''
      window.history.replaceState(null, '', `${window.location.pathname}${keep}`)
    }
    return { ref, error }
  })

  useEffect(() => {
    if (!params.error) return
    const errors = t.landing.errors as Record<string, string>
    toast.error(errors[params.error] ?? t.landing.errors.generic)
  }, [params, t])

  const data = status.data
  // Quien ya pasó por X vuelve a su paso pendiente en vez de repetir el login
  const pending = Boolean(data && data.step !== 'login')
  const configured = data?.configured ?? true
  const cta = { configured, refHandle: params.ref, pending, t }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#0a0b08] text-foreground">
      <div className="relative">
        <RadarBackdrop />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
          <header className="flex items-center gap-2.5">
            <Link href="/app" className="transition-opacity hover:opacity-80">
              <CabalWordmark className="h-8" />
            </Link>
            {/* El idioma se elige desde la primera pantalla: quien llega en
                inglés no tiene que adivinar dónde se cambia. */}
            <LangSwitch className="ml-auto" size="md" />
            <span className="hidden rounded-full border border-[#8FA83F]/40 bg-[#8FA83F]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary md:inline-flex">
              {t.landing.earlyAccess}
            </span>
            <CtaButton {...cta} compact />
          </header>

          <div className="mt-12 md:mt-16">
            <Hero
              total={data?.total ?? 0}
              loading={status.isPending}
              configured={configured}
              refHandle={params.ref}
              pending={pending}
              t={t}
              lang={lang}
            />
          </div>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <section className="mt-16 md:mt-24">
          <h2 className="text-center font-machina text-3xl font-bold uppercase tracking-[0.06em] sm:text-4xl">
            {t.landing.benefitsTitle.before}
            <span className="text-primary">{t.landing.benefitsTitle.accent}</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">{t.landing.benefitsLead}</p>
          <ol className="mt-10 border-t border-white/10">
            {t.landing.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i] ?? Radar
              const shots = BENEFIT_SHOTS[i] ?? []
              return (
                <li
                  key={b.title}
                  className="grid gap-10 border-b border-white/10 py-12 lg:min-h-[130vh] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12 lg:py-20"
                >
                  {/* Texto y acceso: se quedan fijos mientras pasan las capturas */}
                  <div className="lg:sticky lg:top-28 lg:self-start">
                    <span className="font-mono text-[13px] text-primary">[ 0{i + 1}. ]</span>
                    <span className="mt-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#8FA83F]/30 bg-[#8FA83F]/10">
                      <Icon className="h-5 w-5 text-primary" aria-hidden />
                    </span>
                    <h3 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">{b.title}</h3>
                    <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">{b.body}</p>
                    <div className="mt-8">
                      <CtaButton {...cta} compact />
                    </div>
                  </div>
                  <FeatureShots shots={shots} alt={b.title} />
                </li>
              )
            })}
          </ol>
        </section>

        {/* La escuadra: confianza y cifras a la izquierda, personajes a la derecha */}
        <section className="mt-16 grid items-center gap-12 md:mt-24 lg:grid-cols-2">
          <div>
            <h2 className="font-machina text-3xl font-bold uppercase tracking-[0.06em] sm:text-4xl">
              {lang === 'en' ? 'Join the ' : 'Únete a la '}
              <span className="text-primary">{lang === 'en' ? 'squad' : 'escuadra'}</span>
            </h2>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Stat
                label={t.landing.stats.onList}
                value={status.isPending ? '—' : (data?.total ?? 0).toLocaleString(lang)}
                highlight
              />
              <Stat label={t.landing.stats.seats} value="500" />
              <Stat label={t.landing.stats.cost} value={t.common.free} />
            </div>
            <TrustList t={t} />
            <div className="mt-8">
              <CtaButton {...cta} />
            </div>
          </div>
          <Mockup t={t} />
        </section>

        <div id="cabal-app">
          <AllInOne lang={lang === 'en' ? 'en' : 'es'} />
        </div>
        <IntroVideoPopup targetId="cabal-app" lang={lang === 'en' ? 'en' : 'es'} />

        {/* Lanzar un token: pump.fun frente al launchpad propio de Cabal */}
        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            {lang === 'en' ? 'Launch your token: pump.fun vs ' : 'Lanza tu token: pump.fun frente a '}
            <span className="text-amber-300">Cabal Launch</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {lang === 'en'
              ? 'Our own launchpad: you earn almost double per trade than on pump.fun, the token shows up on the Radar by itself and you can schedule it for the exact time.'
              : 'Nuestro propio launchpad: ganas casi el doble por operación que en pump.fun, el token sale solo en el Radar y puedes programarlo a la hora exacta.'}
          </p>
          <div className="mt-7">
            <LaunchComparison lang={lang === 'en' ? 'en' : 'es'} />
          </div>
        </section>

        {/* Cabal frente a las plataformas de trading y de gráficos */}
        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            {lang === 'en' ? 'Cabal vs ' : 'Cabal frente a '}
            <span className="text-primary">{lang === 'en' ? 'the platforms' : 'las plataformas'}</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {lang === 'en'
              ? 'fomo, GigaX, DEX Screener, DEXTools, Axiom and GMGN each do one part. This is what Cabal brings together, what is being built, and what we still lack.'
              : 'fomo, GigaX, DEX Screener, DEXTools, Axiom y GMGN hacen cada una una parte. Esto es lo que Cabal junta, lo que se está construyendo y lo que aún nos falta.'}
          </p>
          <div className="mt-7">
            <PlatformComparison lang={lang === 'en' ? 'en' : 'es'} />
          </div>
        </section>

        {/* Cabal frente a Phanes: la misma tabla que el manual del bot (/bot) */}
        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            {lang === 'en' ? 'Cabal vs ' : 'Cabal frente a '}
            <span className="text-primary">{lang === 'en' ? 'the other bots' : 'los demás bots'}</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {lang === 'en'
              ? 'What the Cabal bot does compared to Phanes, Rick, TTF, CryptoWhale and Proficy — including what we do not have yet.'
              : 'Lo que hace el bot de Cabal comparado con Phanes, Rick, TTF, CryptoWhale y Proficy. Lo que aún no tenemos también está en la tabla.'}
          </p>
          <div className="mt-7">
            <BotComparison lang={lang === 'en' ? 'en' : 'es'} />
          </div>
          <Link href="/bot" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
            {lang === 'en' ? 'See the bot manual →' : 'Ver el manual del bot →'}
          </Link>
        </section>

        <section className="relative mt-20 overflow-hidden rounded-3xl border border-[#8FA83F]/25 px-6 py-16 text-center">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'radial-gradient(60% 90% at 50% 100%, rgba(143,168,63,0.25) 0%, transparent 70%)' }}
          />
          <h2 className="relative font-machina text-3xl font-bold uppercase leading-tight tracking-[0.06em] sm:text-5xl">
            <span className="text-primary">{lang === 'en' ? 'Get in' : 'Entra'}</span>
            <br />
            {lang === 'en' ? 'in less than 30 seconds' : 'en menos de 30 segundos'}
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-sm text-muted-foreground">
            {lang === 'en'
              ? 'Log in with X, claim your spot on the list and share your card.'
              : 'Accede con X, asegura tu lugar en la lista y comparte tu tarjeta.'}
          </p>
          <div className="relative mt-8 flex justify-center">
            <CtaButton {...cta} />
          </div>
        </section>

        <footer className="mt-14 border-t border-white/10 pt-6 text-xs text-muted-foreground">
          <p>
            <span className="font-machina font-bold uppercase tracking-[0.08em] text-foreground">Cabal</span> · cabal.army —{' '}
            {t.landing.footer.tagline}
          </p>
          <p className="mt-1.5">{t.landing.footer.legal}</p>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href={CABAL_X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-bold text-foreground hover:text-primary"
            >
              <XLogo className="h-3 w-3" />@{CABAL_X_HANDLE}
            </a>
            <Link href="/terminos" className="hover:text-foreground">
              {t.landing.footer.terms}
            </Link>
            <Link href="/privacidad" className="hover:text-foreground">
              {t.landing.footer.privacy}
            </Link>
            <Link href="/creditos" className="hover:text-foreground">
              {t.landing.footer.credits}
            </Link>
            <a href="mailto:legal@cabal.army" className="hover:text-foreground">
              legal@cabal.army
            </a>
          </p>
        </footer>
      </div>
    </main>
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
/**
 * Título, acceso con X y el video de presentación a lo ancho, todo centrado:
 * lo primero que se ve es qué es Cabal y cómo entrar.
 */
function Hero({
  total,
  loading,
  configured,
  refHandle,
  pending,
  t,
  lang,
}: {
  total: number
  loading: boolean
  configured: boolean
  refHandle: string | null
  pending: boolean
  t: Dict
  lang: string
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="font-machina text-4xl font-bold uppercase leading-[1.05] tracking-[0.04em] sm:text-6xl md:text-7xl">
        {t.landing.hero.titleTop}{' '}
        <br />
        <span className="text-primary">{t.landing.hero.titleAccent}</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
        {t.landing.hero.body}
      </p>

      {refHandle && (
        <p className="mt-5 inline-flex rounded-xl border border-[#8FA83F]/30 bg-[#8FA83F]/10 px-3.5 py-2 text-[13px]">
          {t.landing.hero.invitedBy} <span className="ml-1 font-bold text-primary">@{refHandle}</span>
        </p>
      )}

      <div className="mt-8 flex w-full flex-col items-center">
        <CtaButton configured={configured} refHandle={refHandle} pending={pending} t={t} />
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
          <Zap className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {t.landing.hero.sharePoints}
        </p>
        {!configured && <p className="mt-1.5 text-[11px] text-muted-foreground">{t.landing.hero.notConfigured}</p>}
        <p className="mt-2 text-[12px] text-muted-foreground">
          <span className="font-bold text-primary">{loading ? '—' : total.toLocaleString(lang)}</span>{' '}
          {t.landing.stats.onList.toLowerCase()} · 500 {t.landing.stats.seats.toLowerCase()}
        </p>
      </div>

      <div className="mt-12 w-full">
        <PresentationVideo />
      </div>
    </div>
  )
}

/**
 * Las capturas de un beneficio, al estilo de Photon: en escritorio quedan
 * pegadas (sticky) y flotando mientras se lee su texto, hasta que llega la
 * siguiente fila. La segunda captura se superpone a la primera.
 */
function FeatureShots({ shots, alt }: { shots: Shot[]; alt: string }) {
  const [main, extra] = shots
  if (!main) return null
  const frame = 'overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f0b] shadow-[0_24px_60px_rgba(0,0,0,0.6)]'
  const tall = main.h > main.w
  return (
    <div className="relative lg:sticky lg:top-24 lg:self-start">
      <div
        aria-hidden
        className="absolute -inset-10 opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(143,168,63,0.18) 0%, transparent 70%)' }}
      />
      <div className={cn('relative', extra && 'pb-16 sm:pb-24', tall && 'mx-auto max-w-[420px]')}>
        <div className={cn(frame, 'animate-squad-sway')}>
          <Image src={main.src} alt={alt} width={main.w} height={main.h} className="h-auto w-full" sizes="(max-width: 1024px) 95vw, 680px" />
        </div>
        {extra && (
          <div
            className={cn(
              frame,
              'absolute bottom-0 right-0 border-[#8FA83F]/40',
              extra.h > extra.w ? 'w-[42%]' : 'w-[62%]'
            )}
            style={{ animation: 'squad-sway 11s ease-in-out infinite reverse' }}
          >
            <Image src={extra.src} alt="" width={extra.w} height={extra.h} className="h-auto w-full" sizes="(max-width: 1024px) 60vw, 420px" />
          </div>
        )}
      </div>
    </div>
  )
}

function TrustList({ t }: { t: Dict }) {
  const TRUST_ICONS = [BadgeCheck, Lock, CheckCircle2]
  return (
    <ul className="mt-7 space-y-2.5">
      {t.landing.trust.map((text, i) => {
        const Icon = TRUST_ICONS[i] ?? BadgeCheck
        return (
          <li key={text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {text}
          </li>
        )
      })}
    </ul>
  )
}

/** Botón principal: pulso de luz y un brillo que lo recorre. */
function CtaButton({
  configured,
  refHandle,
  pending,
  t,
  compact,
}: {
  configured: boolean
  refHandle: string | null
  pending: boolean
  t: Dict
  compact?: boolean
}) {
  const startHref = `/api/waitlist/x/start${refHandle ? `?ref=${encodeURIComponent(refHandle)}` : ''}`
  const classes = compact
    ? 'group relative inline-flex h-10 items-center justify-center gap-2 justify-self-start overflow-hidden rounded-xl bg-primary px-4 text-[13px] font-bold text-primary-foreground transition-transform hover:scale-[1.03] hover:bg-[#9dba46] sm:justify-self-end'
    : 'group animate-cta-glow relative inline-flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-primary px-8 text-[16px] font-bold text-primary-foreground transition-transform hover:scale-[1.02] hover:bg-[#9dba46] sm:w-auto'
  const icon = compact ? 'h-4 w-4' : 'h-5 w-5'

  // Quien ya conectó X continúa donde lo dejó
  if (pending) {
    return (
      <Button asChild className={classes}>
        <Link href="/whitelist">
          <Shine />
          {t.landing.cta.continue}
          <ArrowRight className={cn(icon, 'transition-transform group-hover:translate-x-0.5')} aria-hidden />
        </Link>
      </Button>
    )
  }

  if (!configured) {
    return (
      <Button disabled className={cn(classes, 'animate-none opacity-70')}>
        <XLogo className={icon} /> {t.landing.cta.unavailable}
      </Button>
    )
  }

  return (
    <Button asChild className={classes}>
      <a href={startHref}>
        <Shine />
        <XLogo className={icon} />
        {t.landing.cta.login}
        <ArrowRight className={cn(icon, 'transition-transform group-hover:translate-x-0.5')} aria-hidden />
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
function PresentationVideo() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div
        aria-hidden
        className="absolute -inset-10 rounded-[40px] opacity-70 blur-2xl"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(143,168,63,0.22) 0%, transparent 70%)' }}
      />
      <div className="relative overflow-hidden rounded-3xl border border-[#8FA83F]/40 bg-black shadow-[0_20px_45px_rgba(0,0,0,0.55)]">
        <video
          src={`${INTRO_VIDEO_URL}#t=0.5`}
          data-intro-video
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full"
        />
      </div>
    </div>
  )
}

function Mockup({ t }: { t: Dict }) {
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
          alt={t.landing.mockup.squadAlt}
          fill
          priority
          className="animate-squad-sway relative object-contain drop-shadow-[0_20px_45px_rgba(0,0,0,0.55)]"
          sizes="(max-width: 1024px) 90vw, 520px"
        />
      </div>

      <p className="relative mt-6 text-center text-[12px] text-muted-foreground">
        {t.landing.mockup.before}
        <span className="font-bold text-primary">{t.landing.mockup.card}</span>
        {t.landing.mockup.after}
      </p>
    </div>
  )
}
