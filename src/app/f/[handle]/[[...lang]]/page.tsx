import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WhitelistLanding } from '@/components/cabal/whitelist-landing'
import { buildFollowMetadata, parseHandle } from '@/lib/share-metadata'
import { LOCALES, type Locale } from '@/lib/share-card'

/**
 * Enlace de la campaña "sigue a @Cabal_app": /f/<handle> y /f/<handle>/en.
 *
 * Sirve exactamente la misma landing que /r/<handle> —quien entra por aquí
 * queda igualmente registrado como invitado de <handle> y le genera su
 * porcentaje— pero con otra tarjeta Open Graph. Son dos URLs y no una porque X
 * guarda una sola tarjeta por enlace y no se puede refrescar: si los dos posts
 * compartieran URL, el segundo saldría con la imagen del primero.
 *
 * El idioma va en la ruta y no en la query por lo mismo que en /r: X normaliza
 * las URLs y descarta los parámetros que interpreta como seguimiento.
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
  return buildFollowMetadata(parseHandle(handle), locale)
}

export default async function FollowPage({ params }: { params: Params }) {
  const { handle, lang } = await params
  const ref = parseHandle(handle)
  // Ni un idioma inexistente ni un handle imposible deben generar páginas.
  if (!ref || !resolveLocale(lang)) notFound()
  return <WhitelistLanding refHandle={ref} />
}
