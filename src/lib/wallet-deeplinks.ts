import type { WalletFamily } from '@/lib/wallets'

/**
 * Wallets en el móvil. Ni Safari, ni Chrome de Android, ni la app de Cabal
 * tienen extensiones de wallet, así que no hay nada que conectar. Lo que sí
 * hay son los enlaces "browse" de cada wallet: abren esta misma página dentro
 * del navegador interno de Phantom, Solflare o MetaMask, donde la wallet ya
 * viene inyectada. Desde ahí conectar, firmar y comprar funcionan sin cambios.
 *
 * En la app de iOS esto es además lo que encaja con la App Store (3.1.5): el
 * intercambio de cripto ocurre en la app de la wallet, no en la de Cabal.
 */
export type MobileWallet = { id: string; name: string; link: (url: string) => string }

const PHANTOM: MobileWallet = {
  id: 'phantom',
  name: 'Phantom',
  link: (url) =>
    `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
}

const SOLFLARE: MobileWallet = {
  id: 'solflare',
  name: 'Solflare',
  link: (url) =>
    `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
}

const METAMASK: MobileWallet = {
  id: 'metamask',
  name: 'MetaMask',
  // MetaMask quiere la dirección sin "https://"
  link: (url) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, '')}`,
}

export const MOBILE_WALLETS: Record<WalletFamily, MobileWallet[]> = {
  solana: [PHANTOM, SOLFLARE],
  // Phantom también es wallet EVM (Ethereum, Base, Polygon)
  evm: [METAMASK, PHANTOM],
}

/** Móvil o tablet, incluida la app de Cabal (su User-Agent es el de iOS/Android). */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|CabalApp-/i.test(navigator.userAgent)
}
