import type { DevClaimDTO, DevClaimStats } from '@/lib/types'

/**
 * Reclamos de dev (tokens externos verificados on-chain). Serialización común
 * para el propio usuario (/api/me/claims) y para su perfil público.
 */

function parseStats(raw: string): DevClaimStats | null {
  try {
    const obj = JSON.parse(raw) as DevClaimStats
    return obj && Object.keys(obj).length > 0 ? obj : null
  } catch {
    return null
  }
}

type DbDevClaim = {
  id: string
  network: string
  contract: string
  walletAddress: string
  name: string
  symbol: string
  status: string
  note: string
  stats: string
  source: string
  createdAt: Date
  verifiedAt: Date | null
}

export function serializeDevClaim(c: DbDevClaim): DevClaimDTO {
  return {
    id: c.id,
    network: c.network,
    contract: c.contract,
    walletAddress: c.walletAddress,
    name: c.name,
    symbol: c.symbol,
    status: c.status,
    note: c.note,
    stats: parseStats(c.stats),
    source: c.source,
    createdAt: c.createdAt.toISOString(),
    verifiedAt: c.verifiedAt?.toISOString() ?? null,
  }
}

/**
 * Versión para el perfil público: sin la wallet ni la nota interna. Que un
 * token es suyo ya queda dicho con el estado "verificado"; la dirección concreta
 * con la que lo verificó no hace falta publicarla.
 */
export function publicDevClaim(c: DbDevClaim): DevClaimDTO {
  return { ...serializeDevClaim(c), walletAddress: '', note: '' }
}
