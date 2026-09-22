import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WhitelistLanding } from '@/components/cabal/whitelist-landing'
import { buildDonateMetadata, parseHandle } from '@/lib/share-metadata'
import { LOCALES, type Locale } from '@/lib/share-card'

/**
 * Enlace del post de la donación: /d/<handle> y /d/<handle>/en.
 *
 * Sirve la misma landing que /r/<handle> y /f/<handle> —quien entra por aquí
 * queda igualmente registrado como invitado de <handle>— pero con su propia
 * tarjeta Open Graph. Son URLs distintas porque X guarda una sola tarjeta por
 * enlace y no se puede refrescar: si las campañas compartieran URL, un post
 * saldría con la imagen del otro.
 *
 * El idioma va en la ruta y no en la query por lo mismo que en /r y /f: X
 * normaliza las URLs y descarta los parámetros que interpreta como seguimiento.
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
  return buildDonateMetadata(parseHandle(handle), locale)
}

export default async function DonatePage({ params }: { params: Params }) {
  const { handle, lang } = await params
  const ref = parseHandle(handle)
  // Ni un idioma inexistente ni un handle imposible deben generar páginas.
  if (!ref || !resolveLocale(lang)) notFound()
  return <WhitelistLanding refHandle={ref} />
}
