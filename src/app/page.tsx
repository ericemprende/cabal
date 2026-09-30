import type { Metadata } from 'next'
import { WhitelistLanding } from '@/components/cabal/whitelist-landing'
import { buildShareMetadata, parseHandle } from '@/lib/share-metadata'
import { toLocale, siteUrl } from '@/lib/waitlist'
import { resolveLang } from '@/lib/i18n/server'
import { baseLang } from '@/lib/i18n/config'
import { CABAL_X_URL } from '@/lib/follow-x'

/**
 * Home pública de cabal.army mientras el proyecto no ha abierto: la landing de
 * la lista de espera (whitelist). La plataforma en sí vive en /app hasta el
 * lanzamiento público.
 *
 * Los enlaces de invitación se comparten ahora como /r/<handle> (ver
 * app/r/[handle]). Aquí se siguen atendiendo los antiguos /?ref=<handle> para
 * no romper los que ya están publicados.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; l?: string | string[] }>
}): Promise<Metadata> {
  const { ref, l } = await searchParams
  // Sin ?l, el título sale en el idioma en que se pinta la página (cookie →
  // navegador), para que coincida con el H1.
  const raw = Array.isArray(l) ? l[0] : l
  // La tarjeta para compartir solo existe en es/en: pt y de la reciben en inglés.
  const locale = raw ? toLocale(raw) : baseLang(await resolveLang())
  return buildShareMetadata(parseHandle(ref), locale)
}

/**
 * Datos estructurados (JSON-LD) de la home: solo lo que la página enseña a la
 * vista (nombre, dominio, cuenta de X, correo del pie y descripción).
 */
function jsonLd() {
  const url = siteUrl()
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${url}/#organization`,
        name: 'Cabal',
        url,
        logo: `${url}/cabal-logo.png`,
        email: 'legal@cabal.army',
        sameAs: [CABAL_X_URL],
      },
      {
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        name: 'Cabal',
        url,
        publisher: { '@id': `${url}/#organization` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${url}/#app`,
        name: 'Cabal',
        url,
        applicationCategory: 'FinanceApplication',
        description:
          'The radar where the community spots memecoin launches before they go live: launches posted by the community, dev track records and points redeemable for $CABAL.',
        publisher: { '@id': `${url}/#organization` },
      },
    ],
  }
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify no escapa "<": se sustituye para que nada cierre el <script>
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()).replace(/</g, '\u003c') }}
      />
      <WhitelistLanding />
    </>
  )
}
