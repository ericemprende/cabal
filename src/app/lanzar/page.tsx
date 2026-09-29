'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUI } from '@/lib/store'

/**
 * /lanzar ya no es una página aparte: el formulario vive en la pestaña
 * "Crear token" de /app. Esta ruta se queda para no romper enlaces.
 */
export default function LanzarRedirect() {
  const router = useRouter()
  useEffect(() => {
    useUI.getState().setTab('launch')
    router.replace('/app')
  }, [router])
  return null
}
