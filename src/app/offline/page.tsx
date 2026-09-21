import Link from 'next/link'
import { WifiOff } from 'lucide-react'

/**
 * Lo que se ve al abrir la app instalada sin conexión. El service worker
 * (public/sw.js) guarda esta página al instalarse y la enseña cuando la red
 * falla, en vez del dinosaurio del navegador.
 */
export const metadata = { title: 'Sin conexión — Cabal' }

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <WifiOff className="h-6 w-6 text-primary" aria-hidden />
      </span>
      <div>
        <h1 className="font-machina text-xl font-bold uppercase tracking-wide">Sin conexión</h1>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          El Radar necesita internet para traer los lanzamientos y los precios. Vuelve a intentarlo cuando
          recuperes la señal.
        </p>
      </div>
      <Link
        href="/app"
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
      >
        Reintentar
      </Link>
    </main>
  )
}
