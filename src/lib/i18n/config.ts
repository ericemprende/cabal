/**
 * Idiomas de la plataforma. El idioma NO va en la URL: viaja en una cookie
 * (`cabal-lang`), así que cada dirección sigue siendo la misma para todo el
 * mundo y ningún enlace compartido hasta hoy se rompe.
 *
 * Quien llega sin haber elegido nada ve su idioma del navegador si es español,
 * e inglés en cualquier otro caso. En cuanto toca el selector, su elección
 * manda por encima de todo y se recuerda.
 */
export const LANGS = ['es', 'en'] as const
export type Lang = (typeof LANGS)[number]

export const DEFAULT_LANG: Lang = 'en'
export const LANG_COOKIE = 'cabal-lang'
/** Un año: el idioma es una decisión que no hace falta repetir. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const LANG_META: Record<Lang, { flag: string; label: string; short: string }> = {
  es: { flag: '🇪🇸', label: 'Español', short: 'ES' },
  en: { flag: '🇬🇧', label: 'English', short: 'EN' },
}

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v)
}

/** "es-419", "ES", "es_MX"… → es. Cualquier otra cosa → en. */
export function langFromLocale(code: string | null | undefined): Lang {
  return code?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

/**
 * Idioma que toca según lo que manda el navegador en Accept-Language. Se mira
 * solo la primera preferencia con peso: si alguien pide español antes que
 * inglés, español.
 */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG
  const best = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      return { tag: tag.trim(), q: q ? Number(q.split('=')[1]) || 0 : 1 }
    })
    .filter((p) => p.tag)
    .sort((a, b) => b.q - a.q)[0]
  return langFromLocale(best?.tag)
}
