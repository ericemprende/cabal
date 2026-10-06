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
        <img src="/cabal-logo.png" alt="Cabal" className="h-24 w-24 rounded-2xl" />
        <h1 className="text-3xl font-black tracking-tight">Cabal</h1>
        <span className="-mt-2 rounded-full border border-[#8FA83F]/40 bg-[#8FA83F]/10 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-primary">
          Beta 1.0
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">{tx.tagline}</p>
      </div>
      <div className="relative flex w-full max-w-xs flex-col gap-3">
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
