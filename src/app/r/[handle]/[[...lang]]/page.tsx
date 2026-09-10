import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WhitelistLanding } from '@/components/cabal/whitelist-landing'
import { buildShareMetadata, parseHandle } from '@/lib/share-metadata'
import { LOCALES, type Locale } from '@/lib/share-card'

/**
 * Enlace de invitación: /r/<handle> (español) y /r/<handle>/en (inglés).
 *
 * Sustituye a /?ref=<handle>. Con la invitación en la query, X publicaba todos
 * los posts con la tarjeta de la home en vez de la de cada persona: al buscar
 * la tarjeta en su caché normaliza la URL y descarta `ref`, que trata como
 * parámetro de seguimiento, así que todos los enlaces acababan siendo
 * cabal.army a secas. Un segmento de ruta no se descarta nunca, y cada persona
 * tiene su propia URL.
 *
 * Por eso esta ruta SIRVE la landing en vez de redirigir a /?ref=: X sigue las
 * redirecciones, y la URL final volvería a normalizarse a la home.
 *
 * El idioma va también en la ruta y no en la query, por el mismo motivo.
 */

type Params = Promise<{ handle: string; lang?: string[] }>

/** Resuelve el idioma del segmento opcional; null si la ruta no es válida. */
function resolveLocale(lang: string[] | undefined): Locale | null {
  if (!lang || lang.length === 0) return 'es'
  if (lang.length > 1) return null
  return (LOCALES as readonly string[]).includes(lang[0]) ? (lang[0] as Locale) : null
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle, lang } = await params
  const locale = resolveLocale(lang)
  if (!locale) return {}
  return buildShareMetadata(parseHandle(handle), locale)
}

export default async function InvitePage({ params }: { params: Params }) {
  const { handle, lang } = await params
  const ref = parseHandle(handle)
  // Ni un idioma que no existe ni un handle imposible deben generar páginas:
  // /r/<lo-que-sea>/<lo-que-sea> multiplicaría URLs sin sentido.
  if (!ref || !resolveLocale(lang)) notFound()
  return <WhitelistLanding refHandle={ref} />
}
