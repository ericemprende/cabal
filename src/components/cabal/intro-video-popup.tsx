'use client'

import { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

/** URL del video de presentación; la comparten el hero y este pop-up. */
export const INTRO_VIDEO_URL =
  'https://assets.cdn.filesafe.space/PzBHLZpVRI65nyeCEHng/media/6ac56555dca4eec506170e1d.mp4'

/** Recordado en el navegador: quien ya vio el video (o el pop-up) no lo vuelve a recibir. */
const SEEN_KEY = 'cabal-intro-video-seen'
/** Tiempo mínimo en la página antes de molestar a nadie. */
const MIN_MS_ON_PAGE = 15_000

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {}
}

function alreadySeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Si el visitante baja hasta la sección de la app (`#targetId`) sin haber
 * reproducido el video del hero y lleva ya un rato en la página, le abre el
 * video en un pop-up. Sale una sola vez por navegador. El navegador solo deja
 * arrancar solo un video silenciado, así que empieza sin sonido con un botón
 * grande para activarlo.
 */
export function IntroVideoPopup({ targetId, lang }: { targetId: string; lang: 'es' | 'en' }) {
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (alreadySeen()) return
    const start = Date.now()
    let played = false
    let reached = false

    // Cualquier reproducción del video del hero cuenta como visto
    const onPlay = (e: Event) => {
      if ((e.target as HTMLElement).dataset?.introVideo !== undefined) {
        played = true
        markSeen()
      }
    }
    document.addEventListener('play', onPlay, true)

    const tryOpen = () => {
      if (played || !reached || alreadySeen()) return
      if (Date.now() - start < MIN_MS_ON_PAGE) return
      markSeen()
      setOpen(true)
    }

    const target = document.getElementById(targetId)
    const io = target
      ? new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              reached = true
              tryOpen()
            }
          },
          { threshold: 0.15 }
        )
      : null
    if (target && io) io.observe(target)
    // Si llegó a la sección antes de cumplir el tiempo, se abre al cumplirlo
    const timer = setInterval(tryOpen, 2000)

    return () => {
      document.removeEventListener('play', onPlay, true)
      io?.disconnect()
      clearInterval(timer)
    }
  }, [targetId])

  const unmute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = false
    v.currentTime = 0
    void v.play()
    setMuted(false)
    // Al darle a ver, el video pasa a pantalla completa para verlo en grande
    const el = v as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
    if (el.requestFullscreen) void el.requestFullscreen().catch(() => {})
    else el.webkitEnterFullscreen?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[92vw] max-w-[92vw] gap-0 overflow-hidden sm:max-w-[min(92vw,1280px)] border-[#8FA83F]/40 bg-[#0a0b08] p-0 sm:rounded-2xl">
        <div className="px-5 pb-3 pt-5 pr-12">
          <DialogTitle className="font-display text-lg font-bold sm:text-xl">
            {lang === 'en' ? 'Before you go on: Cabal in 3 minutes' : 'Antes de seguir: Cabal en 3 minutos'}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-muted-foreground">
            {lang === 'en'
              ? 'Here we explain the whole project: what it is, how it works and why to get in early.'
              : 'Aquí explicamos todo el proyecto: qué es, cómo funciona y por qué entrar antes.'}
          </DialogDescription>
        </div>
        <div className="relative bg-black">
          <video
            ref={videoRef}
            src={INTRO_VIDEO_URL}
            data-intro-video
            autoPlay
            muted={muted}
            controls={!muted}
            playsInline
            className="aspect-video max-h-[78vh] w-full"
          />
          {muted && (
            <button
              type="button"
              onClick={unmute}
              className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/20"
            >
              <span className="animate-cta-glow inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-black">
                <Volume2 className="h-5 w-5" aria-hidden />
                {lang === 'en' ? 'Watch with sound' : 'Ver con sonido'}
              </span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
