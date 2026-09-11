import { db } from '@/lib/db'
import { cached } from '@/lib/cache'
import { fetchMarketBatch, fetchTokenStats, isValidContract, isValidNetwork } from '@/lib/chain-stats'
import type { CallEvidenceDTO } from '@/lib/types'

/**
 * Evidencia de una call: a qué precio y en qué mercado estaba el contrato
 * cuando alguien la publicó, y cómo le va desde entonces.
 *
 * La foto de entrada (entryPriceUsd/entryMc/entryDexId/entryPairUrl) se toma
 * UNA sola vez, al crear el post — es la prueba de "a qué precio la llamé" y
 * no se vuelve a tocar. El precio actual se calcula en caliente en cada
 * lectura, comparándolo contra el mercado en vivo.
 */

/** De qué proyecto de Cabal habla la call, si venía enlazada a uno. */
export async function resolveCallTarget(body: {
  contract?: unknown
  network?: unknown
  launchId?: unknown
  tokenId?: unknown
}): Promise<{ contract: string; network: string } | null> {
  // Prioridad: el CA que se pegó a mano en el composer…
  const rawContract = typeof body.contract === 'string' ? body.contract.trim() : ''
  const rawNetwork = typeof body.network === 'string' ? body.network.trim() : ''
  if (rawContract && isValidNetwork(rawNetwork) && isValidContract(rawNetwork, rawContract)) {
    return { contract: rawContract, network: rawNetwork }
  }
  // …si no, el contrato del launch o token al que se enlazó la call
  if (typeof body.launchId === 'string' && body.launchId) {
    const l = await db.launch.findUnique({ where: { id: body.launchId }, select: { contract: true, network: true } })
    if (l?.contract) return { contract: l.contract, network: l.network }
  }
  if (typeof body.tokenId === 'string' && body.tokenId) {
    const t = await db.token.findUnique({ where: { id: body.tokenId }, select: { contract: true, network: true } })
    if (t?.contract) return { contract: t.contract, network: t.network }
  }
  return null
}

/** Foto del contrato en el instante de la call. Best-effort: si no se encuentra, null. */
export async function snapshotCallEntry(
  network: string,
  contract: string
): Promise<Pick<CallEvidenceDTO, 'entryPriceUsd' | 'entryMc' | 'dexId' | 'pairUrl'> | null> {
  const stats = await fetchTokenStats(network, contract).catch(() => null)
  if (!stats?.found || !stats.priceUsd) return null
  return {
    entryPriceUsd: stats.priceUsd,
    entryMc: stats.marketCap ?? stats.fdv ?? 0,
    dexId: stats.dexId || '',
    pairUrl: stats.pairUrl || '',
  }
}

/**
 * Precio de mercado actual de varios contratos, cacheado unos segundos: un
 * feed con varias calls no debe pedirle uno a uno el mismo precio a
 * DexScreener en cada carga.
 */
export async function liveMarketFor(contracts: string[]): Promise<Map<string, { priceUsd: number; marketCap: number }>> {
  const unique = [...new Set(contracts.filter(Boolean))].sort()
  if (unique.length === 0) return new Map()
  const key = `calls:market:${unique.join(',')}`
  const rows = await cached(key, 30, async () => [...(await fetchMarketBatch(unique)).entries()])
  return new Map(rows)
}

/** % de cambio entre la entrada y ahora, o null si falta algún dato o la entrada es 0. */
export function pctChange(entry: number | null | undefined, current: number | null | undefined): number | null {
  if (!entry || current == null) return null
  return ((current - entry) / entry) * 100
}
