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

// chainId de DexScreener por red de Cabal
const DEX_CHAIN: Record<string, string> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  bsc: 'bsc',
  tron: 'tron',
  robinhood: 'robinhood',
}

// network id de GeckoTerminal para el OHLCV del ATH. "robinhood" SÍ es un id
// válido — no aparece en GET /networks (esa lista parece no incluir todas
// las redes nuevas/de nicho), pero /search/pools y /ohlcv sí lo reconocen,
// comprobado con una consulta real: devuelven velas de verdad. Se había
// quitado por error creyendo que no existía; el bug real de "0.0%" era el
// fallback (ver más abajo), no la falta de esta red.
const GECKO_NETWORK: Record<string, string> = {
  solana: 'solana',
  ethereum: 'eth',
  base: 'base',
  bsc: 'bsc',
  tron: 'tron',
  robinhood: 'robinhood',
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

/**
 * Precio más alto alcanzado DESDE `sinceMs` (no el ATH histórico): con velas
 * de hora alcanza ~41 días hacia atrás; si la call es más vieja que eso, cae
 * a velas diarias para no perder el pico solo por quedar fuera de rango.
 */
async function fetchPeakSince(
  network: string,
  pairAddress: string,
  sinceMs: number
): Promise<{ peakPrice: number | null; peakAt: number | null }> {
  const geckoNet = GECKO_NETWORK[network]
  if (!geckoNet || !pairAddress) return { peakPrice: null, peakAt: null }

  const scan = (list: number[][]): { peakPrice: number | null; peakAt: number | null } => {
    let peakPrice: number | null = null
    let peakAt: number | null = null
    for (const c of list) {
      const tsRaw = Number(c[0])
      const ts = tsRaw > 1e12 ? tsRaw : tsRaw * 1000
      if (ts < sinceMs) continue
      const high = Number(c[2])
      if (!Number.isFinite(high) || high <= 0) continue
      if (peakPrice === null || high > peakPrice) {
        peakPrice = high
        peakAt = ts
      }
    }
    return { peakPrice, peakAt }
  }

  const hourUrl = `https://api.geckoterminal.com/api/v2/networks/${geckoNet}/pools/${pairAddress}/ohlcv/hour?aggregate=1&limit=1000`
  const hourJson = await fetchJson<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(hourUrl, 7000)
  const hourCandles = hourJson?.data?.attributes?.ohlcv_list ?? []
  // Si la vela más vieja que trajimos ya es posterior a `sinceMs`, la resolución
  // de hora no cubre toda la ventana desde la call: completamos con velas diarias.
  const oldestHourTs = hourCandles.length
    ? (() => {
        const raw = Number(hourCandles[hourCandles.length - 1][0])
        return raw > 1e12 ? raw : raw * 1000
      })()
    : null
  let result = scan(hourCandles)
  if (oldestHourTs === null || oldestHourTs > sinceMs) {
    const dayUrl = `https://api.geckoterminal.com/api/v2/networks/${geckoNet}/pools/${pairAddress}/ohlcv/day?aggregate=1&limit=1000`
    const dayJson = await fetchJson<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(dayUrl, 7000)
    const dayResult = scan(dayJson?.data?.attributes?.ohlcv_list ?? [])
    if (dayResult.peakPrice !== null && (result.peakPrice === null || dayResult.peakPrice > result.peakPrice)) {
      result = dayResult
    }
  }
  return result
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

// ── Resultado de una call (feed): precio de entrada vs. precio actual ──

export type CallResult = {
  found: boolean
  entryPriceUsd: number | null
  currentPriceUsd: number | null
  /** market cap (o FDV) en el momento de la call, estimado con supply constante */
  entryMc: number | null
  currentMc: number | null
  /** precio/MC más alto alcanzado DESDE la call (no el ATH histórico del token) */
  peakPriceUsd: number | null
  peakMc: number | null
  peakAt: number | null
  symbol: string
  image: string
  pctChange: number | null
  /** veces que multiplicó desde la call hasta AHORA (solo si subió), p. ej. 3 = "hizo 3x" */
  multiple: number | null
  /** veces que multiplicó desde la call hasta su PICO, aunque después haya bajado */
  peakMultiple: number | null
  pairUrl: string
}

const EMPTY_CALL_RESULT: CallResult = {
  found: false,
  entryPriceUsd: null,
  currentPriceUsd: null,
  entryMc: null,
  currentMc: null,
  peakPriceUsd: null,
  peakMc: null,
  peakAt: null,
  symbol: '',
  image: '',
  pctChange: null,
  multiple: null,
  peakMultiple: null,
  pairUrl: '',
}

/**
 * No guardamos precio de entrada al publicar la call: solo el instante
 * (`calledAt`, el `createdAt` del post). El resultado se calcula siempre al
 * vuelo, comparando el precio actual (DexScreener) contra la vela de un
 * minuto más cercana a `calledAt` (GeckoTerminal OHLCV). Si la call es tan
 * reciente que esa vela aún no existe, se usa el precio actual como entrada
 * (0%) en vez de fallar.
 */
export async function fetchCallResult(network: string, ca: string, calledAt: Date): Promise<CallResult> {
  const dexChain = DEX_CHAIN[network]
  if (!dexChain) return { ...EMPTY_CALL_RESULT }

  const json = await fetchJson<{ pairs?: DexInfoPair[] }>(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(ca)}`,
    8000
  )
  const pair = pickPair(json?.pairs ?? [], ca) as DexInfoPair | null
  if (!pair) return { ...EMPTY_CALL_RESULT }

  // Mismo logo que fetchTokenMeta: el de DexScreener si cotiza ahí, o si no
  // (solana) el de la CDN de pump.fun — no hace falta otra petición, la URL
  // es determinística a partir del contrato.
  const image = safeUrl(pair.info?.imageUrl) || (network === 'solana' ? `https://images.pump.fun/coin-image/${encodeURIComponent(ca)}?variant=600x600` : '')

  const currentPriceUsd = pair.priceUsd ? Number(pair.priceUsd) || null : null
  const currentMc = pair.marketCap ?? pair.fdv ?? null

  let entryPriceUsd: number | null = null
  const geckoNet = GECKO_NETWORK[network]
  if (geckoNet && pair.pairAddress) {
    // antes de calledAt + un pequeño margen, para asegurarnos de que la vela
    // de ese minuto ya exista cuando se pide justo después de publicar
    const beforeTs = Math.floor(calledAt.getTime() / 1000) + 90
    const url = `https://api.geckoterminal.com/api/v2/networks/${geckoNet}/pools/${pair.pairAddress}/ohlcv/minute?aggregate=1&before_timestamp=${beforeTs}&limit=1`
    const candles = await fetchJson<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(url, 7000)
    const c = candles?.data?.attributes?.ohlcv_list?.[0]
    if (c && Number(c[4]) > 0) entryPriceUsd = Number(c[4])
  }
  // Call recién publicada: aún no hay vela de ese minuto. Entrada = precio
  // actual (0%) — pero solo si de verdad hay una fuente de velas para esta
  // red; si no la hay (geckoNet), mejor dejar "sin datos" que fingir 0%.
  if (entryPriceUsd === null && geckoNet) entryPriceUsd = currentPriceUsd

  const pctChange =
    entryPriceUsd && currentPriceUsd && entryPriceUsd > 0
      ? ((currentPriceUsd - entryPriceUsd) / entryPriceUsd) * 100
      : null

  // MC/FDV al momento de la call: no lo guardamos en la BD, así que se estima
  // a partir del MC actual escalado por el cambio de precio (supply constante).
  const entryMc =
    currentMc && entryPriceUsd && currentPriceUsd && currentPriceUsd > 0
      ? Math.round(currentMc * (entryPriceUsd / currentPriceUsd))
      : null

  const multiple =
    pctChange !== null && pctChange > 0 && entryPriceUsd && currentPriceUsd
      ? currentPriceUsd / entryPriceUsd
      : null

  let peakPriceUsd: number | null = null
  let peakMc: number | null = null
  let peakAt: number | null = null
  let peakMultiple: number | null = null
  if (geckoNet && pair.pairAddress && entryPriceUsd) {
    const peak = await fetchPeakSince(network, pair.pairAddress, calledAt.getTime())
    // El pico nunca puede ser menor que el precio actual (última vela puede no
    // haber cerrado aún); si algo salió raro, usamos el actual como piso.
    if (peak.peakPrice !== null && currentPriceUsd !== null) {
      peakPriceUsd = Math.max(peak.peakPrice, currentPriceUsd)
      peakAt = peakPriceUsd === currentPriceUsd && peak.peakPrice !== peakPriceUsd ? null : peak.peakAt
      if (currentMc && currentPriceUsd > 0) {
        peakMc = Math.round(currentMc * (peakPriceUsd / currentPriceUsd))
      }
      peakMultiple = peakPriceUsd / entryPriceUsd
    }
  }

  return {
    found: true,
    entryPriceUsd,
    currentPriceUsd,
    entryMc,
    currentMc,
    peakPriceUsd,
    peakMc,
    peakAt,
    symbol: pair.baseToken?.symbol ?? '',
    image,
    pctChange,
    multiple,
    peakMultiple,
    pairUrl: pair.url ?? '',
  }
}

/** Datos de mercado de un token para la pestaña Tokens. */
export type MarketSnapshot = {
  priceUsd: number
  marketCap: number
  volume24h: number
  change24h: number
}

/**
 * Datos de mercado de varios tokens de una vez: DexScreener admite hasta 30
 * contratos por llamada. Devuelve solo los que tienen par; los que aún no
 * cotizan (p. ej. en la curva de pump.fun) no aparecen en el mapa.
 */
export async function fetchMarketBatch(contracts: string[]): Promise<Map<string, MarketSnapshot>> {
  const out = new Map<string, MarketSnapshot>()
  const unique = [...new Set(contracts.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30)
    const json = await fetchJson<{ pairs?: DexPair[] }>(
      `https://api.dexscreener.com/latest/dex/tokens/${chunk.map(encodeURIComponent).join(',')}`,
      8000
    )
    for (const ca of chunk) {
      const pair = pickPair(json?.pairs ?? [], ca)
      if (!pair) continue
      out.set(ca, {
        priceUsd: pair.priceUsd ? Number(pair.priceUsd) || 0 : 0,
        // marketCap cuando DexScreener lo da; si no, el FDV es la mejor aproximación
        marketCap: pair.marketCap ?? pair.fdv ?? 0,
        volume24h: pair.volume?.h24 ?? 0,
        change24h: pair.priceChange?.h24 ?? 0,
      })
    }
  }
  return out
}
