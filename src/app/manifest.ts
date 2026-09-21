import type { MetadataRoute } from 'next'

/**
 * Manifiesto de la PWA: lo que convierte a cabal.army en una app instalable
 * (icono en la pantalla de inicio, pantalla completa sin barra del navegador).
 *
 * Los iconos los genera `bun run icons:pwa` a partir de public/cabal-logo.png.
 * El "maskable" lleva margen para que Android pueda recortarlo en círculo.
 *
 * Este mismo manifiesto es el que leerán Google Play (si algún día se publica
 * como TWA) y las herramientas de empaquetado, así que conviene que name,
 * description e iconos sean los definitivos.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cabal — Radar de Memecoins',
    short_name: 'Cabal',
    description:
      'Descubre los memecoins antes de que salgan: lanzamientos de la comunidad, tesis, chat en vivo y ranking de callers.',
    // Arranca en la app, no en la portada de marketing
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0b08',
    theme_color: '#0a0b08',
    lang: 'es',
    dir: 'ltr',
    categories: ['finance', 'social', 'news'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Accesos directos al mantener pulsado el icono de la app
    shortcuts: [
      { name: 'Radar de launches', url: '/app', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Publicar launch', url: '/publicar' },
      { name: 'Chat en vivo', url: '/app?tab=chat' },
    ],
  }
}
