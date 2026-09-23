import { cookies, headers } from 'next/headers'
import { DEFAULT_LANG, LANG_COOKIE, isLang, langFromAcceptLanguage, type Lang } from '@/lib/i18n/config'

/**
 * Idioma con el que se sirve una página: manda lo que la persona eligió
 * (cookie) y, si nunca eligió, lo que pide su navegador.
 *
 * Se resuelve en el servidor para que el HTML llegue ya en su idioma: si se
 * decidiera en el navegador, la primera pintada saldría en el idioma que no es
 * y cambiaría a la vista de todos.
 */
export async function resolveLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value
  if (isLang(saved)) return saved
  try {
    return langFromAcceptLanguage((await headers()).get('accept-language'))
  } catch {
    return DEFAULT_LANG
  }
}
