'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/lib/api-client'
import { useLang } from '@/lib/i18n/provider'
import { baseLang } from '@/lib/i18n/config'
import { useUI } from '@/lib/store'
import { Button } from '@/components/ui/button'

/**
 * Bienvenida de la app instalada (Android TWA / PWA en la pantalla de inicio).
 *
 * En la web, /app se puede recorrer sin cuenta y el login vive en la cabecera.
 * Dentro de la app eso se siente como entrar a la plataforma de golpe, así que
 * quien abre la app sin sesión ve primero esta portada con entrar / crear
 * cuenta. Puede seguir sin cuenta: se recuerda solo durante esta sesión.
 */

const TEXT = {
  es: {
    tagline: 'El radar donde la comunidad ve los memecoins antes de que salgan.',
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
    guest: 'Explorar sin cuenta',
  },
  en: {
    tagline: 'The radar where the community spots memecoins before they launch.',
    login: 'Log in',
    register: 'Create account',
    guest: 'Browse without an account',
  },
}

const SKIP_KEY = 'cabal:app-welcome-skipped'

function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    document.referrer.startsWith('android-app://')
  )
}

export function AppWelcomeGate() {
  const [lang] = useLang()
  const tx = TEXT[baseLang(lang)]
  const { data: session, isFetched } = useSession()
  const { authOpen, openAuth } = useUI()
  const [skipped, setSkipped] = useState(true)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setInstalled(isInstalledApp())
    try {
      setSkipped(sessionStorage.getItem(SKIP_KEY) === '1')
    } catch {
      setSkipped(false)
    }
  }, [])

  // Mientras el diálogo de login está abierto la portada se aparta
  if (!installed || skipped || !isFetched || session?.loggedIn || authOpen) return null

  const skip = () => {
    try {
      sessionStorage.setItem(SKIP_KEY, '1')
    } catch {
      // sin almacenamiento solo vuelve a salir la portada
    }
    setSkipped(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-[#0a0b08] px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_30%,rgba(143,168,63,0.28),transparent_65%)]"
      />
      <div className="relative flex flex-col items-center gap-4">
        {/* Logo como un radar: barrido girando y ondas que salen, y un "pulso" al entrar */}
        <div className="relative flex h-44 w-44 items-center justify-center">
          <style>{`
            @keyframes cabal-sweep { to { transform: rotate(360deg) } }
            @keyframes cabal-wave { 0% { transform: scale(.55); opacity: .7 } 100% { transform: scale(1.35); opacity: 0 } }
            @keyframes cabal-pop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 80% { transform: scale(.97) } 100% { transform: scale(1) } }
            @keyframes cabal-glow { 0%,100% { box-shadow: 0 0 24px rgba(143,168,63,.35) } 50% { box-shadow: 0 0 48px rgba(143,168,63,.7) } }
            @media (prefers-reduced-motion: reduce) { .cabal-anim { animation: none !important } }
          `}</style>
          <span aria-hidden className="absolute inset-0 rounded-full border border-[#8FA83F]/25" />
          <span aria-hidden className="absolute inset-6 rounded-full border border-[#8FA83F]/20" />
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden
              className="cabal-anim absolute inset-0 rounded-full border-2 border-[#8FA83F]/60"
              style={{ animation: `cabal-wave 2.4s ease-out ${i * 0.8}s infinite`, opacity: 0 }}
            />
          ))}
          <span
            aria-hidden
            className="cabal-anim absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, rgba(143,168,63,.45), rgba(143,168,63,0) 70deg, transparent 360deg)',
              animation: 'cabal-sweep 2.4s linear infinite',
            }}
          />
          <img
            src="/cabal-logo.png"
            alt="Cabal"
            className="cabal-anim relative h-24 w-24 rounded-2xl"
            style={{ animation: 'cabal-pop .7s cubic-bezier(.2,.8,.2,1) both, cabal-glow 2.4s ease-in-out .7s infinite' }}
          />
        </div>
        <h1 className="text-3xl font-black tracking-tight">Cabal</h1>
        <span className="-mt-2 rounded-full border border-[#8FA83F]/40 bg-[#8FA83F]/10 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-primary">
          Beta 1.0
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">{tx.tagline}</p>
      </div>
      <div className="relative flex w-full max-w-xs flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-300">
        <Button size="lg" className="w-full" onClick={() => openAuth('login')}>
          {tx.login}
        </Button>
        <Button size="lg" variant="secondary" className="w-full" onClick={() => openAuth('register')}>
          {tx.register}
        </Button>
        <button type="button" onClick={skip} className="mt-1 text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
          {tx.guest}
        </button>
      </div>
    </div>
  )
}
