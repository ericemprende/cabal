'use client'

import { LANGS, LANG_META, type Lang } from '@/lib/i18n/config'
import { useLang } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'

/**
 * Selector de idioma: las dos banderitas, siempre visibles. Cambiar de idioma
 * no recarga nada y se recuerda en este navegador (cookie), así que la
 * siguiente visita llega ya traducida.
 */
export function LangSwitch({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  const [lang, setLang] = useLang()

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-white/10 bg-[#0f110c] p-0.5',
        className
      )}
      role="group"
      aria-label={LANG_META[lang].label}
    >
      {LANGS.map((l) => (
        <LangButton key={l} lang={l} active={l === lang} size={size} onPick={setLang} />
      ))}
    </div>
  )
}

function LangButton({
  lang,
  active,
  size,
  onPick,
}: {
  lang: Lang
  active: boolean
  size: 'sm' | 'md'
  onPick: (l: Lang) => void
}) {
  const meta = LANG_META[lang]
  return (
    <button
      type="button"
      onClick={() => onPick(lang)}
      aria-pressed={active}
      title={meta.label}
      className={cn(
        'flex items-center gap-1 rounded-full font-bold uppercase tracking-wider transition-colors',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1.5 text-xs',
        active ? 'bg-[#8FA83F]/20 text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <span aria-hidden>{meta.flag}</span>
      {meta.short}
    </button>
  )
}
