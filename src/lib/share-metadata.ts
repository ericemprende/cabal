import type { Metadata } from 'next'
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

  const ogTitle = handle
    ? locale === 'en'
      ? `@${handle} is part of Cabal.army`
      : `@${handle} ya es parte de Cabal.army`
    : TITLE
  const ogDescription = handle
    ? locale === 'en'
      ? `@${handle} invites you to the Cabal waitlist: the radar where the community spots memecoins BEFORE they launch.`
      : `@${handle} te invita a la lista de espera de Cabal: el radar donde la comunidad ve los memecoins ANTES de que salgan.`
    : DESCRIPTION

  // Cada invitación es canónica de sí misma, nunca de la home: X guarda la
  // tarjeta de la home de cuando era la app, sin imagen válida.
  const url = shareRefUrl(handle, locale)

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
