import { cn } from '@/lib/utils'

/**
 * Banderitas de idioma dibujadas a mano.
 *
 * No se usan los emoji 🇪🇸/🇬🇧 porque Windows no trae la fuente que los pinta:
 * en la mitad de los escritorios salen como dos letras sueltas ("ES", "GB"),
 * que es justo lo contrario de lo que hace útil una bandera.
 */
export function Flag({ lang, className }: { lang: 'es' | 'en'; className?: string }) {
  const common = cn('inline-block shrink-0 rounded-[2px] ring-1 ring-black/30', className)

  if (lang === 'es') {
    return (
      <svg viewBox="0 0 24 16" className={common} aria-hidden focusable="false">
        <rect width="24" height="16" fill="#c60b1e" />
        <rect y="4" width="24" height="8" fill="#ffc400" />
      </svg>
    )
  }

  // Union Jack simplificada: las aspas blancas y rojas sobre el azul bastan
  // para reconocerla a 16px, que es el tamaño al que se va a ver siempre.
  return (
    <svg viewBox="0 0 24 16" className={common} aria-hidden focusable="false">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="3.2" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#c8102e" strokeWidth="1.8" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5.4" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="3.2" />
    </svg>
  )
}
