import type { Metadata } from 'next'
import { WhitelistLanding } from '@/components/cabal/whitelist-landing'
import { shareCardUrl, siteUrl } from '@/lib/waitlist'

/**
 * Home pública de cabal.army mientras el proyecto no ha abierto: la landing de
 * la lista de espera (whitelist). La plataforma en sí vive en /app hasta el
 * lanzamiento público.
 */
const title = 'Cabal — Entra al radar antes que el resto'
const description =
  'Lista de espera de Cabal: el radar donde la comunidad descubre los memecoins ANTES de que salgan. Regístrate con tu cuenta de X y reserva tu plaza.'

/**
 * Los metadatos cambian según el enlace:
 *  - cabal.army            → tarjeta genérica del proyecto.
 *  - cabal.army/?ref=pepe  → tarjeta personalizada de @pepe, que es la imagen
 *    que X pinta cuando él publica su enlace de afiliado. Es la única forma de
 *    que el post lleve imagen: un intent de X no admite adjuntos.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>
}): Promise<Metadata> {
  const { ref } = await searchParams
  const raw = Array.isArray(ref) ? ref[0] : ref
  const handle = raw?.replace(/^@+/, '').trim()
  const valid = handle && /^[\w]{1,15}$/.test(handle) ? handle : null

  const image = valid
    ? { url: shareCardUrl(valid), width: 1672, height: 941, alt: `@${valid} en Cabal.army` }
    : { url: '/og-cabal.png', width: 1200, height: 630, alt: 'Cabal' }

  const ogTitle = valid ? `@${valid} ya es parte de Cabal.army` : title
  const ogDescription = valid
    ? `@${valid} te invita a la lista de espera de Cabal: el radar donde la comunidad ve los memecoins ANTES de que salgan.`
    : description

  return {
    title,
    description,
    metadataBase: new URL(siteUrl()),
    alternates: { canonical: '/' },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: valid ? `${siteUrl()}/?ref=${valid}` : siteUrl(),
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

export default function Page() {
  return <WhitelistLanding />
}
