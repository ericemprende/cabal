'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

/**
 * Instalar Cabal como app (PWA).
 *
 * - Android/Chrome/Edge: el navegador avisa con `beforeinstallprompt`; se
 *   guarda el evento y el botón lo dispara.
 * - iPhone: Safari no tiene ese evento, así que solo se puede explicar el
 *   camino (Compartir → Añadir a pantalla de inicio).
 * - Si ya está instalada (display-mode: standalone) no se enseña nada.
 *
 * El registro del service worker vive aquí también, para tener en un solo
 * sitio todo lo que hace de Cabal una app instalable.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISS_KEY = 'cabal:install-dismissed'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS marca las apps de la pantalla de inicio con esto
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function InstallApp() {
  const t = useT()
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [show, setShow] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)

  // Registro del service worker (solo en producción y sobre https)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  useEffect(() => {
    if (isStandalone()) return
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {}
    if (dismissed) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    // iPhone: no hay evento, se enseña la explicación a los pocos segundos
    const t = isIos() ? setTimeout(() => setShow(true), 4000) : undefined
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      if (t) clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    setShow(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
  }

  const install = async () => {
    if (!event) {
      setIosHelp(true)
      return
    }
    await event.prompt()
    await event.userChoice.catch(() => null)
    setEvent(null)
    dismiss()
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl border border-[#8FA83F]/30 bg-[#121410]/95 p-3 shadow-lg backdrop-blur-md md:hidden"
      role="dialog"
      aria-label={t.install.aria}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">{t.install.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {iosHelp
              ? t.install.iosBody
              : t.install.body}
          </p>
          {!iosHelp && (
            <button
              onClick={install}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground"
            >
              {isIos() ? <Share className="h-3.5 w-3.5" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
              {isIos() ? t.install.iosCta : t.install.cta}
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label={t.install.dismiss}
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
