'use client'

import { Check, ChevronDown } from 'lucide-react'
import { LANGS, LANG_META } from '@/lib/i18n/config'
import { useLang, useT } from '@/lib/i18n/provider'
import { Flag } from '@/components/cabal/flag'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/**
 * Selector de idioma: un botón con la bandera del idioma actual que despliega
 * la lista. Con dos idiomas iban las banderitas en fila, pero con cuatro ya no
 * caben en la barra. Cambiar de idioma no recarga nada y se recuerda en este
 * navegador (cookie), así que la siguiente visita llega ya traducida.
 */
export function LangSwitch({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  const [lang, setLang] = useLang()
  const t = useT()
  const flagSize = size === 'sm' ? 'h-3 w-[18px]' : 'h-3.5 w-[21px]'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t.lang.label}: ${LANG_META[lang].label}`}
        className={cn(
          'flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0f110c] font-bold uppercase tracking-wider text-foreground/90 transition-colors hover:text-foreground',
          size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs',
          className
        )}
      >
        <Flag lang={lang} className={flagSize} />
        {LANG_META[lang].short}
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {LANGS.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => setLang(l)} className="gap-2">
            <Flag lang={l} className="h-3.5 w-[21px]" />
            <span className="flex-1">{LANG_META[l].label}</span>
            {l === lang && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
