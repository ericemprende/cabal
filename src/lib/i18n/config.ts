/**
 * Idiomas de la plataforma. El idioma NO va en la URL: viaja en una cookie
 * (`cabal-lang`), así que cada dirección sigue siendo la misma para todo el
 * mundo y ningún enlace compartido hasta hoy se rompe.
 *
 * Quien llega sin haber elegido nada ve su idioma del navegador si lo tenemos
 * (español, inglés, portugués, alemán), e inglés en cualquier otro caso. En
 * cuanto toca el selector, su elección manda por encima de todo y se recuerda.
 *
 * Añadir un idioma: su diccionario en dictionaries/ (tipado con Dict, así que
 * no compila si le falta una clave), su entrada aquí y su bandera en flag.tsx.
 */
export const LANGS = ['es', 'en', 'pt', 'de'] as const
export type Lang = (typeof LANGS)[number]

/**
 * Las piezas que solo tienen texto en español e inglés (tablas comparativas,
 * bots, correos) usan esto: el español para el español y el inglés para todo
 * lo demás, que un brasileño o un alemán lo lee antes que el español.
 */
export type BaseLang = 'es' | 'en'
export function baseLang(lang: Lang | string | null | undefined): BaseLang {
  return lang === 'es' ? 'es' : 'en'
}

export const DEFAULT_LANG: Lang = 'en'
export const LANG_COOKIE = 'cabal-lang'
/** Un año: el idioma es una decisión que no hace falta repetir. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const LANG_META: Record<Lang, { flag: string; label: string; short: string }> = {
  es: { flag: '🇪🇸', label: 'Español', short: 'ES' },
  en: { flag: '🇬🇧', label: 'English', short: 'EN' },
  pt: { flag: '🇧🇷', label: 'Português', short: 'PT' },
  de: { flag: '🇩🇪', label: 'Deutsch', short: 'DE' },
}

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v)
}

/** "es-419", "pt-BR", "de_AT"… → es, pt, de. Cualquier otra cosa → en. */
export function langFromLocale(code: string | null | undefined): Lang {
  const base = code?.toLowerCase().slice(0, 2)
  return isLang(base) ? base : 'en'
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
