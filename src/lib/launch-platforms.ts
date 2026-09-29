import type { NetworkKey } from '@/lib/cabal'

/**
 * Launchpads del formulario único de /lanzar (como el de GMGN). Cada uno es
 * una integración aparte con su SDK; `live: false` sale en la cuadrícula como
 * "Próximamente" y no deja lanzar. Los límites de nombre y ticker son los de
 * cada plataforma.
 */
/** Plataformas que ya lanzan de verdad (tienen adaptador en lib/pump-launch.ts). */
export type LaunchPlatformId = 'pump' | 'bonk'

export type LaunchPlatform = {
  id: string
  name: string
  network: NetworkKey
  live: boolean
  limits: { name: number; symbol: number }
}

export const LAUNCH_PLATFORMS: LaunchPlatform[] = [
  { id: 'pump', name: 'Pump', network: 'solana', live: true, limits: { name: 32, symbol: 10 } },
  { id: 'bonk', name: 'Bonk', network: 'solana', live: true, limits: { name: 32, symbol: 10 } },
  { id: 'bags', name: 'Bags', network: 'solana', live: false, limits: { name: 32, symbol: 10 } },
  { id: 'heaven', name: 'Heaven', network: 'solana', live: false, limits: { name: 32, symbol: 10 } },
  { id: 'moonshot', name: 'Moonshot', network: 'solana', live: false, limits: { name: 32, symbol: 10 } },
  { id: 'meteora', name: 'Meteora', network: 'solana', live: false, limits: { name: 32, symbol: 10 } },
  { id: 'four', name: 'Four', network: 'bsc', live: false, limits: { name: 20, symbol: 20 } },
  { id: 'flap', name: 'Flap', network: 'bsc', live: false, limits: { name: 20, symbol: 20 } },
  { id: 'clanker', name: 'Clanker', network: 'base', live: false, limits: { name: 32, symbol: 20 } },
]

export function launchPlatform(id: string): LaunchPlatform {
  return LAUNCH_PLATFORMS.find((p) => p.id === id) ?? LAUNCH_PLATFORMS[0]
}
