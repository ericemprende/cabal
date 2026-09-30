'use client'

import { useEffect, useState } from 'react'
import { purchasesAllowed } from '@/lib/native-app'

/**
 * purchasesAllowed() como hook: la primera pintada coincide con la del
 * servidor (que no sabe si es la app de iOS) y se corrige al montar, sin
 * errores de hidratación.
 */
export function usePurchasesAllowed(): boolean {
  const [allowed, setAllowed] = useState(true)
  useEffect(() => setAllowed(purchasesAllowed()), [])
  return allowed
}
