'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LANG, LANG_COOKIE, LANG_COOKIE_MAX_AGE, isLang, type Lang } from '@/lib/i18n/config'
import { dictionaries, type Dict } from '@/lib/i18n/dictionaries'

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  dict: Dict
}

const LangContext = createContext<Ctx | null>(null)

/**
 * Idioma de la plataforma. El servidor ya resuelve cuál toca (ver
 * i18n/server.ts) y lo entrega aquí, así que la primera pintada sale correcta;
 * cambiarlo desde los ajustes no recarga nada, solo cambia el diccionario.
 */
export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)

  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return
    setLangState(next)
    // Cookie y no localStorage: el servidor tiene que poder leerla para servir
    // la siguiente página ya traducida.
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`
    document.documentElement.lang = next
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<Ctx>(() => ({ lang, setLang, dict: dictionaries[lang] }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

function useLangContext(): Ctx {
  const ctx = useContext(LangContext)
  // Sin proveedor (una pieza suelta en un test, o un árbol que aún no lo
  // tiene) se responde en el idioma por defecto en vez de reventar.
  return ctx ?? { lang: DEFAULT_LANG, setLang: () => {}, dict: dictionaries[DEFAULT_LANG] }
}

export function useLang(): [Lang, (l: Lang) => void] {
  const { lang, setLang } = useLangContext()
  return [lang, setLang]
}

/**
 * Textos de la interfaz. `t.radar.empty` es texto; lo que lleva datos dentro
 * es una función: `t.radar.count(3)`.
 */
export function useT(): Dict {
  return useLangContext().dict
}
