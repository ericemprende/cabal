'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useUI, type TabKey } from '@/lib/store'

/**
 * Cambiar de sección (Radar, Tokens, Feed, Líderes) desde cualquier página.
 *
 * Las secciones son pestañas de /app guardadas en el store, no rutas. Dentro de
 * /app basta con cambiar la pestaña; desde otra página, como un perfil, además
 * hay que volver a /app o el cambio no se vería.
 */
export function useGoToTab() {
  const setTab = useUI((s) => s.setTab)
  const pathname = usePathname()
  const router = useRouter()
  return (tab: TabKey) => {
    setTab(tab)
    if (pathname !== '/app') router.push('/app')
  }
}
