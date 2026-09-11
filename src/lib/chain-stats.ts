/**
 * Datos on-chain reales para la verificación de devs.
 * - DexScreener → par principal (precio, FDV, liquidez, volumen, edad).
 * - GeckoTerminal OHLCV → ATH histórico del par (mejor esfuerzo).
 * - RPC Solana  → % de supply en las top-10 wallets (mejor esfuerzo).
 * Todo es best-effort: si una fuente falla, se devuelve lo que haya.
 */

export type ChainStats = {
  found: boolean
  name: string
  symbol: string
  priceUsd: number | null
  fdv: number | null
  marketCap: number | null
  liquidityUsd: number | null
  volume24h: number | null
  change24h: number | null
  /** ms epoch de la creación del par */
  pairCreatedAt: number | null
  dexId: string
  pairUrl: string
  /** ATH histórico (mejor esfuerzo vía OHLCV) */
  athPrice: number | null
  athAt: number | null
  /** ATH expresado en FDV estimado (asume supply constante) */
  athFdv: number | null
  /** % del supply en las top-10 wallets (solo Solana, mejor esfuerzo) */
  top10Pct: number | null
}

type DexPair = {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken?: { address?: string; name?: string; symbol?: string }
  priceUsd?: string
  fdv?: number
  marketCap?: number
  liquidity?: { usd?: number }
  volume?: { h24?: number }
  priceChange?: { h24?: number }
  pairCreatedAt?: number
}

// chainId de DexScreener por red de Cabal (robinhood aún no está listado allí)
const DEX_CHAIN: Record<string, string> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  bsc: 'bsc',
  tron: 'tron',
}

// network id de GeckoTerminal para el OHLCV del ATH
const GECKO_NETWORK: Record<string, string> = {
  solana: 'solana',
  ethereum: 'eth',
  base: 'base',
  bsc: 'bsc',
  tron: 'tron',
}

export function isValidNetwork(network: string): boolean {
  return ['solana', 'ethereum', 'base', 'bsc', 'tron', 'robinhood'].includes(network)
}

/** Valida el formato del CA según la red. */
export function isValidContract(network: string, ca: string): boolean {
  if (!ca || ca.length < 2 || ca.length > 90) return false
  if (network === 'ethereum' || network === 'base' || network === 'bsc' || network === 'robinhood') {
    return /^0x[a-fA-F0-9]{40}$/.test(ca)
  }
  // solana / tron: base58 (tron además empieza con T)
  if (network === 'tron') return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(ca)
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)
}

async function fetchJson<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const EMPTY: ChainStats = {
  found: false,
  name: '',
  symbol: '',
  priceUsd: null,
  fdv: null,
  marketCap: null,
  liquidityUsd: null,
  volume24h: null,
  change24h: null,
  pairCreatedAt: null,
  dexId: '',
  pairUrl: '',
  athPrice: null,
  athAt: null,
  athFdv: null,
  top10Pct: null,
}

/** Par con mayor liquidez cuyo baseToken coincida con el CA buscado. */
function pickPair(pairs: DexPair[], ca: string): DexPair | null {
  const caLower = ca.toLowerCase()
  const matches = (pairs ?? []).filter(
    (p) => (p.baseToken?.address ?? '').toLowerCase() === caLower
  )
  if (matches.length === 0) return null
  return matches.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
}

/** ATH histórico vía velas diarias del par (GeckoTerminal). */
async function fetchAth(
  network: string,
  pairAddress: string
): Promise<{ athPrice: number | null; athAt: number | null }> {
  const geckoNet = GECKO_NETWORK[network]
  if (!geckoNet || !pairAddress) return { athPrice: null, athAt: null }
  const url = `https://api.geckoterminal.com/api/v2/networks/${geckoNet}/pools/${pairAddress}/ohlcv/day?aggregate=1&limit=1000`
  const json = await fetchJson<{ data?: { attributes?: { ohlcv_list?: unknown[][] } } }>(url, 7000)
  const candles = json?.data?.attributes?.ohlcv_list ?? []
  let athPrice: number | null = null
  let athAt: number | null = null
  for (const c of candles) {
    const ts = Number(c[0])
    const high = Number(c[2])
    if (!Number.isFinite(high) || high <= 0) continue
    if (athPrice === null || high > athPrice) {
      athPrice = high
      // GeckoTerminal devuelve el timestamp en segundos
      athAt = ts > 1e12 ? ts : ts * 1000
    }
  }
  return { athPrice, athAt }
}

/** Top-10 % del supply vía RPC público de Solana (mejor esfuerzo). */
async function fetchTop10Solana(ca: string): Promise<number | null> {
  const rpc = 'https://api.mainnet-beta.solana.com'
  const body = (method: string, params: unknown[]) =>
    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const [largestRes, supplyRes] = await Promise.all([
      fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body('getTokenLargestAccounts', [ca]),
        signal: ctrl.signal,
        cache: 'no-store',
      }),
      fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body('getTokenSupply', [ca]),
        signal: ctrl.signal,
        cache: 'no-store',
      }),
    ])
    if (!largestRes.ok || !supplyRes.ok) return null
    const largest = (await largestRes.json()) as {
      result?: { value?: { uiAmount?: number | null }[] }
    }
    const supply = (await supplyRes.json()) as {
      result?: { value?: { uiAmount?: number | null } }
    }
    const total = supply.result?.value?.uiAmount
    const accounts = (largest.result?.value ?? []).slice(0, 10)
    if (!total || total <= 0 || accounts.length === 0) return null
    const top10 = accounts.reduce((acc, a) => acc + (a.uiAmount ?? 0), 0)
    return Math.round((top10 / total) * 1000) / 10
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ── Ficha pública del token (para autocompletar el formulario de publicar) ──

export type TokenMeta = {
  found: boolean
  /** 'dexscreener' si ya cotiza; 'pumpfun' si aún está en la curva de pump.fun */
  source: 'dexscreener' | 'pumpfun' | ''
  network: string
  name: string
  symbol: string
  image: string
  banner: string
  description: string
  website: string
  twitter: string
  telegram: string
}

type DexInfoPair = DexPair & {
  info?: {
    imageUrl?: string
    header?: string
    websites?: { url?: string; label?: string }[]
    socials?: { type?: string; url?: string }[]
  }
}

const NETWORK_BY_DEX_CHAIN: Record<string, string> = Object.fromEntries(
  Object.entries(DEX_CHAIN).map(([net, chain]) => [chain, net])
)

/** Solo URLs https (evita javascript:, http plano, etc.) */
function safeUrl(u: unknown): string {
  return typeof u === 'string' && /^https:\/\/\S+$/i.test(u) && u.length <= 500 ? u : ''
}

function socialUrl(type: string, u: unknown): string {
  if (typeof u !== 'string' || !u.trim()) return ''
  const v = u.trim()
  if (/^https:\/\//i.test(v)) return safeUrl(v)
  // pump.fun a veces guarda solo el @ o el dominio sin esquema
  const clean = v.replace(/^@+/, '').replace(/^https?:\/\//i, '')
  if (type === 'twitter' && /^[\w]{1,15}$/.test(clean)) return `https://x.com/${clean}`
  if (type === 'telegram' && /^[\w]{4,40}$/.test(clean)) return `https://t.me/${clean}`
  return safeUrl(`https://${clean}`)
}

/**
 * Nombre, ticker, imagen, banner, descripción y redes de un token a partir de
 * su CA. Primero DexScreener (cualquier red, detecta la red sola); si no cotiza
 * y parece Solana, prueba pump.fun (tokens aún en la curva). Nunca lanza.
 */
export async function fetchTokenMeta(ca: string): Promise<TokenMeta> {
  const meta: TokenMeta = {
    found: false, source: '', network: '', name: '', symbol: '', image: '',
    banner: '', description: '', website: '', twitter: '', telegram: '',
  }

  const json = await fetchJson<{ pairs?: DexInfoPair[] }>(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(ca)}`,
    8000
  )
  const pair = pickPair(json?.pairs ?? [], ca) as DexInfoPair | null
  if (pair) {
    meta.found = true
    meta.source = 'dexscreener'
    meta.network = NETWORK_BY_DEX_CHAIN[pair.chainId] ?? ''
    meta.name = pair.baseToken?.name ?? ''
    meta.symbol = pair.baseToken?.symbol ?? ''
    meta.image = safeUrl(pair.info?.imageUrl)
    meta.banner = safeUrl(pair.info?.header)
    meta.website = safeUrl(pair.info?.websites?.[0]?.url)
    for (const s of pair.info?.socials ?? []) {
      const type = (s.type ?? '').toLowerCase()
      if ((type === 'twitter' || type === 'x') && !meta.twitter) meta.twitter = socialUrl('twitter', s.url)
      if (type === 'telegram' && !meta.telegram) meta.telegram = socialUrl('telegram', s.url)
    }
  }

  // pump.fun: completa lo que falte (o todo si aún no cotiza en un DEX)
  if (isValidContract('solana', ca) && (!pair || pair.chainId === 'solana')) {
    const pf = await fetchJson<{
      name?: string; symbol?: string; description?: string; image_uri?: string
      banner_uri?: string; twitter?: string; telegram?: string; website?: string
    }>(`https://frontend-api-v3.pump.fun/coins/${encodeURIComponent(ca)}`, 6000)
    if (pf && (pf.name || pf.symbol)) {
      if (!meta.found) {
        meta.found = true
        meta.source = 'pumpfun'
        meta.network = 'solana'
      }
      meta.name ||= pf.name ?? ''
      meta.symbol ||= pf.symbol ?? ''
      // El logo, de la CDN de pump.fun y no de image_uri: esa apunta a ipfs.io,
      // que da 429 en cuanto hay tráfico. La CDN es la que usa su propia web
      // (Cloudflare Images, ~80KB). El banner no tiene equivalente fiable y se
      // queda en IPFS; la app lo sirve desde su copia (lib/remote-image).
      if (!meta.image && pf.image_uri) {
        meta.image = `https://images.pump.fun/coin-image/${encodeURIComponent(ca)}?variant=600x600`
      }
      meta.banner ||= safeUrl(pf.banner_uri)
      meta.description ||= (pf.description ?? '').slice(0, 1000)
      meta.website ||= socialUrl('website', pf.website)
      meta.twitter ||= socialUrl('twitter', pf.twitter)
      meta.telegram ||= socialUrl('telegram', pf.telegram)
    }
  }

  meta.name = meta.name.slice(0, 60)
  meta.symbol = meta.symbol.replace(/^\$/, '').toUpperCase().slice(0, 20)
  return meta
}

/** Métricas reales del token (DexScreener + ATH + top10). Nunca lanza. */
export async function fetchTokenStats(network: string, ca: string): Promise<ChainStats> {
  const dexChain = DEX_CHAIN[network]
  if (!dexChain) return { ...EMPTY }

  const json = await fetchJson<{ pairs?: DexPair[] }>(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(ca)}`,
    8000
  )
  const pair = pickPair(json?.pairs ?? [], ca)
  if (!pair) return { ...EMPTY }

  const priceUsd = pair.priceUsd ? Number(pair.priceUsd) || null : null
  const fdv = pair.fdv ?? null

  const stats: ChainStats = {
    found: true,
    name: pair.baseToken?.name ?? '',
    symbol: pair.baseToken?.symbol ?? '',
    priceUsd,
    fdv,
    marketCap: pair.marketCap ?? null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    volume24h: pair.volume?.h24 ?? null,
    change24h: pair.priceChange?.h24 ?? null,
    pairCreatedAt: pair.pairCreatedAt ?? null,
    dexId: pair.dexId ?? '',
    pairUrl: pair.url ?? '',
    athPrice: null,
    athAt: null,
    athFdv: null,
    top10Pct: null,
  }

  // ATH histórico (mejor esfuerzo, no bloquea el resultado si falla)
  const ath = await fetchAth(network, pair.pairAddress)
  stats.athPrice = ath.athPrice
  stats.athAt = ath.athAt
  if (ath.athPrice && priceUsd && fdv && priceUsd > 0) {
    stats.athFdv = Math.round(ath.athPrice * (fdv / priceUsd))
  }

  // Concentración top-10 (solo Solana)
  if (network === 'solana') {
    stats.top10Pct = await fetchTop10Solana(ca)
  }

  return stats
}
