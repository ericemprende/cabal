import type { Metadata } from 'next'
import { CABAL_X_HANDLE, followCardUrl, followRefUrl } from '@/lib/follow-x'
import { donateCardUrl, donateRefUrl } from '@/lib/donate-server'
import { shareCardUrl, shareRefUrl, siteUrl, type Locale } from '@/lib/waitlist'

/**
 * Metadatos de la landing de la lista de espera, con o sin invitación.
 *
 * Los comparten la home (`/`, incluidos los enlaces antiguos `/?ref=`) y la ruta
 * de invitación (`/r/<handle>`), para que las dos pinten la misma tarjeta.
 *
 * Sin handle → tarjeta genérica del proyecto. Con handle → la tarjeta de esa
 * persona, que es la imagen que X enseña cuando publica su enlace.
 */

const TITLE = 'Cabal — Entra al radar antes que el resto'
const DESCRIPTION =
  'Lista de espera de Cabal: el radar donde la comunidad descubre los memecoins ANTES de que salgan. Regístrate con tu cuenta de X y reserva tu plaza.'
const TITLE_EN = 'Cabal — Get on the radar before everyone else'
const DESCRIPTION_EN =
  'Cabal waitlist: the radar where the community spots memecoins BEFORE they launch. Sign up with your X account and reserve your spot.'

/** Un @usuario de X válido (1-15 caracteres de letras, cifras o `_`), o null. */
export function parseHandle(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  const handle = value?.replace(/^@+/, '').trim()
  return handle && /^\w{1,15}$/.test(handle) ? handle : null
}

export function buildShareMetadata(handle: string | null, locale: Locale): Metadata {
  const image = handle
    ? {
        url: shareCardUrl(handle, locale),
        width: 1672,
        height: 941,
        alt: `@${handle} en Cabal.army`,
      }
    : { url: '/og-cabal.png', width: 1200, height: 630, alt: 'Cabal' }

  // El título repite el H1 de la landing en su idioma: título y H1 alineados
  // para que buscadores y asistentes identifiquen de qué va la página.
  const title = locale === 'en' ? TITLE_EN : TITLE
  const description = locale === 'en' ? DESCRIPTION_EN : DESCRIPTION

  const ogTitle = handle
    ? locale === 'en'
      ? `@${handle} is part of Cabal.army`
      : `@${handle} ya es parte de Cabal.army`
    : title
  const ogDescription = handle
    ? locale === 'en'
      ? `@${handle} invites you to the Cabal waitlist: the radar where the community spots memecoins BEFORE they launch.`
      : `@${handle} te invita a la lista de espera de Cabal: el radar donde la comunidad ve los memecoins ANTES de que salgan.`
    : description

  // Cada invitación es canónica de sí misma, nunca de la home: X guarda la
  // tarjeta de la home de cuando era la app, sin imagen válida.
  const url = shareRefUrl(handle, locale)

  return {
    title,
    description,
    metadataBase: new URL(siteUrl()),
    alternates: { canonical: handle ? url : '/' },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url,
      siteName: 'Cabal',
      type: 'website',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [image.url],
    },
  }
}

/**
 * Metadatos del enlace de la campaña "sigue a @Cabal_app" (`/f/<handle>`).
 *
 * Es una ruta aparte de `/r/<handle>` porque X guarda UNA tarjeta por URL: si
 * las dos campañas compartieran enlace, la segunda heredaría la imagen que X
 * cacheó de la primera y no habría forma de refrescarla (retiraron el validador
 * en 2022). Con una URL propia, cada post lleva su tarjeta.
 */
export function buildFollowMetadata(handle: string | null, locale: Locale): Metadata {
  const image = handle
    ? {
        url: followCardUrl(handle, locale),
        width: 1672,
        height: 941,
        alt: `@${handle} sigue a @${CABAL_X_HANDLE}`,
      }
    : { url: '/og-cabal.png', width: 1200, height: 630, alt: 'Cabal' }

  const ogTitle = handle
    ? locale === 'en'
      ? `@${handle} follows @${CABAL_X_HANDLE}`
      : `@${handle} ya sigue a @${CABAL_X_HANDLE}`
    : TITLE
  const ogDescription = handle
    ? locale === 'en'
      ? `Follow @${CABAL_X_HANDLE} and join @${handle} on the Cabal radar: memecoins spotted before they launch.`
      : `Sigue a @${CABAL_X_HANDLE} y entra con @${handle} al radar de Cabal: los memecoins, antes de que salgan.`
    : DESCRIPTION

  const url = followRefUrl(handle, locale)

  return {
    title: TITLE,
    description: DESCRIPTION,
    metadataBase: new URL(siteUrl()),
    alternates: { canonical: handle ? url : '/' },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url,
      siteName: 'Cabal',
      type: 'website',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [image.url],
    },
  }
}

/**
 * Metadatos del enlace del post de la donación (`/d/<handle>`).
 *
 * Tercera campaña, tercera ruta, por lo mismo que /f: X guarda UNA tarjeta por
 * URL y no hay forma de refrescarla, así que cada post necesita su enlace para
 * llevar su imagen.
 */
export function buildDonateMetadata(handle: string | null, locale: Locale): Metadata {
  const image = handle
    ? {
        url: donateCardUrl(handle, locale),
        width: 1672,
        height: 941,
        alt: `@${handle} donó a @${CABAL_X_HANDLE}`,
      }
    : { url: '/og-cabal.png', width: 1200, height: 630, alt: 'Cabal' }

  const ogTitle = handle
    ? locale === 'en'
      ? `@${handle} backs @${CABAL_X_HANDLE}`
      : `@${handle} sostiene a @${CABAL_X_HANDLE}`
    : TITLE
  const ogDescription = handle
    ? locale === 'en'
      ? `@${handle} donated to keep Cabal free and ad-free: the radar where the community spots memecoins BEFORE they launch. Chip in too.`
      : `@${handle} donó para mantener Cabal gratis y sin anuncios: el radar donde la comunidad ve los memecoins ANTES de que salgan. Aporta tú también.`
    : DESCRIPTION

  const url = donateRefUrl(handle, locale)

  return {
    title: TITLE,
    description: DESCRIPTION,
    metadataBase: new URL(siteUrl()),
    alternates: { canonical: handle ? url : '/' },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url,
      siteName: 'Cabal',
      type: 'website',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [image.url],
    },
  }
}
