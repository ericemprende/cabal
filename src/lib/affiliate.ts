import { db } from '@/lib/db'
import { NETWORKS, type NetworkKey } from '@/lib/cabal'

/** Presets de plataformas afiliadas que se auto-crean la primera vez. */
export const AFFILIATE_PRESETS: { name: string; slug: string; order: number }[] = [
  { name: 'GMGN', slug: 'gmgn', order: 1 },
  { name: 'Axiom Pro', slug: 'axiom', order: 2 },
  { name: 'Photon', slug: 'photon', order: 3 },
  { name: 'BullX', slug: 'bullx', order: 4 },
  { name: 'Birdeye', slug: 'birdeye', order: 5 },
  { name: 'DEXScreener', slug: 'dexscreener', order: 6 },
]

/** Redes que se ofrecen en el admin para enlazar una plataforma afiliada. */
export const AFFILIATE_NETWORKS: NetworkKey[] = [
  'solana',
  'base',
  'ethereum',
  'bsc',
  'tron',
  'robinhood',
  'arc',
]

/**
 * Slug de cadena canónico por red (el que usan GMGN y la mayoría:
 * gmgn.ai/{red}/token/…). Si una plataforma usa otro slug (ej. Axiom con
 * ?chain=bnb para BSC), el admin pega el enlace exacto en "DE LA RED …".
 */
export const CHAIN_SLUGS: Record<NetworkKey, string> = {
  solana: 'sol',
  base: 'base',
  ethereum: 'eth',
  bsc: 'bsc',
  tron: 'tron',
  robinhood: 'robinhood',
  arc: 'arc',
}

/** Garantiza que los presets existan (idempotente, corre una sola vez por BD vacía). */
export async function ensureAffiliatePresets() {
  const count = await db.affiliatePlatform.count()
  if (count > 0) return
  await db.affiliatePlatform.createMany({
    data: AFFILIATE_PRESETS.map((p) => ({ ...p, url: '', links: '{}', active: false })),
  })
}

/** Valida el enlace madre de referido (https obligatorio). */
export function isValidAffiliateUrl(v: string): boolean {
  return /^https:\/\/\S+$/i.test(v.trim())
}

/**
 * Filtra y valida el mapa de enlaces por red que manda el admin.
 * Devuelve solo redes conocidas con URL https válida, listo para serializar.
 */
export function sanitizeAffiliateLinks(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: Record<string, string> = {}
  for (const key of AFFILIATE_NETWORKS) {
    const v = (input as Record<string, unknown>)[key]
    if (typeof v === 'string' && v.trim()) {
      const url = v.trim().slice(0, 500)
      if (isValidAffiliateUrl(url)) out[key] = url
    }
  }
  return out
}

/** Parseo seguro del JSON de enlaces por red guardado en la BD. */
export function parseAffiliateLinks(json: string): Record<string, string> {
  try {
    return sanitizeAffiliateLinks(JSON.parse(json))
  } catch {
    return {}
  }
}

/**
 * Resuelve los placeholders de un enlace de referido:
 *  - {ca}  → contrato del token (URL-encoded)
 *  - {red} → slug de la cadena (sol, base, eth, bsc, tron, robinhood)
 */
export function resolveAffiliateUrl(
  template: string,
  contract?: string | null,
  network?: string | null
): string {
  let url = template
  if (url.includes('{red}')) {
    const slug = network ? CHAIN_SLUGS[network as NetworkKey] ?? network : ''
    url = url.replaceAll('{red}', encodeURIComponent(slug))
  }
  if (url.includes('{ca}')) {
    url = url.replaceAll('{ca}', encodeURIComponent(contract ?? ''))
  }
  return url
}

export interface AffiliateLinkSource {
  url: string
  links: Record<string, string>
}

/**
 * Elige el enlace final de una plataforma para un token concreto:
 *  1. El enlace "DE LA RED {red}" del token, si existe (prioritario).
 *  2. El enlace madre general, si existe.
 * Si el enlace elegido necesita {ca} y el token no tiene contrato, no hay
 * enlace útil (null) — p. ej. un launch aún sin desplegar.
 */
export function platformLinkFor(
  platform: AffiliateLinkSource,
  network: string,
  contract?: string | null
): string | null {
  const candidates = [platform.links?.[network], platform.url]
  for (const tpl of candidates) {
    if (!tpl) continue
    if (tpl.includes('{ca}') && !contract) continue
    return resolveAffiliateUrl(tpl, contract, network)
  }
  return null
}
