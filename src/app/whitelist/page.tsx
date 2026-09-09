import type { Metadata } from 'next'
import { WhitelistSteps } from '@/components/cabal/whitelist-steps'

/**
 * Pasos 2 y 3 del registro en la lista de espera: datos básicos y tarjeta para
 * compartir. Aquí llega el usuario tras autorizar su cuenta de X en la home.
 * No se indexa: es una página privada del flujo, no una landing.
 */
export const metadata: Metadata = {
  title: 'Completa tu registro — Cabal',
  description: 'Termina tu registro en la lista de espera de Cabal.army.',
  robots: { index: false, follow: false },
}

export default function WhitelistPage() {
  return <WhitelistSteps />
}
