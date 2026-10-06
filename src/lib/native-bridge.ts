'use client'

import { isAndroidInstalledApp, isIosApp } from '@/lib/native-app'

/**
 * Puente con la app nativa (Capacitor, carpeta mobile/). La web se carga en
 * vivo dentro de la app y Capacitor le inyecta `window.Capacitor` con los
 * plugins instalados en el proyecto nativo, así que no hace falta importar
 * ningún paquete de Capacitor aquí: en el navegador normal todo esto no hace nada.
 */
type Listener = { remove: () => Promise<void> | void }
type CapPlugins = {
  Browser?: { open: (o: { url: string; presentationStyle?: string }) => Promise<void>; close: () => Promise<void> }
  App?: { addListener: (ev: 'appUrlOpen', cb: (e: { url: string }) => void) => Promise<Listener> | Listener }
  AppLauncher?: { openUrl: (o: { url: string }) => Promise<{ completed: boolean }> }
}

function plugins(): CapPlugins | null {
  if (typeof window === 'undefined') return null
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: CapPlugins } }).Capacitor
  return cap?.isNativePlatform?.() ? cap.Plugins ?? null : null
}

/**
 * Abre un enlace fuera de Cabal: en la app nativa con AppLauncher (los enlaces
 * universales de Phantom o Solflare abren su app), y en el navegador del móvil
 * navegando a él, que es lo que dispara el enlace universal.
 */
export async function openExternal(url: string) {
  const launcher = plugins()?.AppLauncher
  if (launcher) {
    try {
      await launcher.openUrl({ url })
      return
    } catch {
      /* sin la app instalada sigue abajo: la web de la wallet ofrece instalarla */
    }
  }
  window.location.href = url
}

/**
 * Arranca un OAuth. En la web, redirección normal. En la app de iOS, en el
 * navegador del sistema (Google no deja hacerlo en un WebView), marcado con
 * app=1 y, si es para vincular una red, con un token que dice a qué cuenta.
 */
export async function startOAuth(provider: 'x' | 'google' | 'discord', mode: 'login' | 'link') {
  const path = `/api/auth/${provider}/start${mode === 'login' ? '?mode=login' : ''}`
  if (isAndroidInstalledApp()) {
    // App de Android: el OAuth acaba en el navegador o en la app de X; con
    // app=android el servidor devuelve a la persona a Cabal al terminar.
    const url = new URL(path, window.location.origin)
    url.searchParams.set('app', 'android')
    if (mode === 'link') {
      const res = await fetch('/api/auth/app-link-token', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { token?: string }
      if (data.token) url.searchParams.set('link', data.token)
    }
    window.location.assign(url.toString())
    return
  }
  const browser = isIosApp() ? plugins()?.Browser : undefined
  if (!browser) {
    window.location.assign(path)
    return
  }
  const url = new URL(path, window.location.origin)
  url.searchParams.set('app', '1')
  if (mode === 'link') {
    const res = await fetch('/api/auth/app-link-token', { method: 'POST' })
    const data = (await res.json().catch(() => ({}))) as { token?: string }
    if (!data.token) {
      window.location.assign(path)
      return
    }
    url.searchParams.set('link', data.token)
  }
  await browser.open({ url: url.toString(), presentationStyle: 'popover' })
}

/**
 * Vuelta del OAuth: army.cabal.app://auth?p=google&ok=1&login=1&t=…
 * Cierra el navegador del sistema y termina dentro de la app: con token pasa
 * por /api/auth/app-handoff (que pone la sesión), sin él vuelve a /app con el
 * resultado para que se enseñe el aviso de siempre.
 */
export function listenForAppAuth(): () => void {
  const p = plugins()
  if (!p?.App) return () => {}
  let handle: Listener | null = null
  let cancelled = false
  Promise.resolve(
    p.App.addListener('appUrlOpen', ({ url }) => {
      if (!url.startsWith('army.cabal.app://auth')) return
      const q = new URL(url).searchParams
      void p.Browser?.close().catch(() => {})
      const provider = q.get('p') ?? 'google'
      if (q.get('t')) {
        const next = new URLSearchParams({ t: q.get('t')!, p: provider })
        if (q.get('created')) next.set('created', '1')
        window.location.assign(`/api/auth/app-handoff?${next}`)
        return
      }
      q.delete('p')
      window.location.assign(`/app?connected=${encodeURIComponent(provider)}&${q}`)
    })
  ).then((h) => {
    if (cancelled) void h.remove()
    else handle = h
  })
  return () => {
    cancelled = true
    void handle?.remove()
  }
}
