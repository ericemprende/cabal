/* eslint-disable no-undef */
/**
 * Service worker de Cabal (PWA).
 *
 * Reglas, pensadas para que un despliegue nuevo nunca deje a nadie con una
 * versión vieja pegada:
 *  - Las páginas van SIEMPRE a la red primero. Si no hay conexión, se enseña
 *    /offline (lo único que se guarda de antemano).
 *  - Los archivos de /_next/static y /icons llevan hash o no cambian nunca:
 *    esos sí se sirven de la caché primero.
 *  - /api y todo lo que no sea GET no se cachea jamás: son datos en vivo
 *    (precios, chat, sesión) y cachearlos daría información falsa.
 *
 * También deja listos los avisos push para cuando se activen en el servidor.
 */

const VERSION = 'v1'
const SHELL = `cabal-shell-${VERSION}`
const ASSETS = `cabal-assets-${VERSION}`
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isStatic(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Solo lo de nuestro propio dominio; nunca la API
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error())))
    return
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(ASSETS).then((c) => c.put(request, copy))
            }
            return res
          })
      )
    )
  }
})

// ---- Avisos push (aún no se envían desde el servidor; el soporte ya está) ----
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Cabal'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'cabal',
      data: { url: data.url || '/app' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/app'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})
