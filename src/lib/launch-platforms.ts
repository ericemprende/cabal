import type { NetworkKey } from '@/lib/cabal'

/**
 * Launchpads del formulario único de /lanzar (como el de GMGN). Cada uno es
 * una integración aparte con su SDK; `live: false` sale en la cuadrícula como
 * "Próximamente" y no deja lanzar. Los límites de nombre y ticker son los de
 * cada plataforma.
 */
/** Plataformas que ya lanzan de verdad (tienen adaptador en lib/pump-launch.ts). */
export type LaunchPlatformId = 'pump' | 'bonk' | 'cabal'

export type LaunchPlatform = {
  id: string
  name: string
  network: NetworkKey
  live: boolean
  /** Icono oficial de su web, en public/launchpads */
  logo: string
  limits: { name: number; symbol: number }
}

export const LAUNCH_PLATFORMS: LaunchPlatform[] = [
  // Launchpad propio (Meteora DBC, ver lib/cabal-launch.ts): el dev se lleva
  // el 70 % de las comisiones. Solo lanza cuando su configuración existe
  { id: 'cabal', name: 'Cabal', network: 'solana', live: true, logo: '/cabal-logo.png', limits: { name: 32, symbol: 10 } },
  { id: 'pump', name: 'Pump', network: 'solana', live: true, logo: '/launchpads/pump.png', limits: { name: 32, symbol: 10 } },
  { id: 'bonk', name: 'Bonk', network: 'solana', live: true, logo: '/launchpads/bonk.png', limits: { name: 32, symbol: 10 } },
  { id: 'bags', name: 'Bags', network: 'solana', live: false, logo: '/launchpads/bags.png', limits: { name: 32, symbol: 10 } },
  { id: 'heaven', name: 'Heaven', network: 'solana', live: false, logo: '/launchpads/heaven.png', limits: { name: 32, symbol: 10 } },
  { id: 'moonshot', name: 'Moonshot', network: 'solana', live: false, logo: '/launchpads/moonshot.png', limits: { name: 32, symbol: 10 } },
  { id: 'meteora', name: 'Meteora', network: 'solana', live: false, logo: '/launchpads/meteora.png', limits: { name: 32, symbol: 10 } },
  { id: 'four', name: 'Four', network: 'bsc', live: false, logo: '/launchpads/four.png', limits: { name: 20, symbol: 20 } },
  { id: 'flap', name: 'Flap', network: 'bsc', live: false, logo: '/launchpads/flap.png', limits: { name: 20, symbol: 20 } },
  { id: 'clanker', name: 'Clanker', network: 'base', live: false, logo: '/launchpads/clanker.png', limits: { name: 32, symbol: 20 } },
]

export function launchPlatform(id: string): LaunchPlatform {
  return LAUNCH_PLATFORMS.find((p) => p.id === id) ?? LAUNCH_PLATFORMS[0]
}
