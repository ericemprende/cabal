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
  arc: 'arc',
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
  arc: 'arc', // aparece en GET /networks de GeckoTerminal
}

export function isValidNetwork(network: string): boolean {
  return ['solana', 'ethereum', 'base', 'bsc', 'tron', 'robinhood', 'arc'].includes(network)
}

/** Valida el formato del CA según la red. */
export function isValidContract(network: string, ca: string): boolean {
  if (!ca || ca.length < 2 || ca.length > 90) return false
  if (network === 'ethereum' || network === 'base' || network === 'bsc' || network === 'robinhood' || network === 'arc') {
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

/**
 * Máximo "creíble" de cada vela ([ts, open, high, low, close, vol]), o null si
 * la vela se descarta. GeckoTerminal a veces devuelve velas corruptas (una
 * mecha o una vela entera miles de veces por encima del resto) que luego
 * corrige; como el pico guardado nunca baja, una sola dejaba una call en
 * "7252x" para siempre. Así:
 *  - la mecha se limita a 3x el cuerpo (max de apertura/cierre);
 *  - una vela cuyo cuerpo es 20x mayor que el de sus dos vecinas se ignora.
 */
const MAX_WICK = 3
const MAX_JUMP = 20
function candleTops(list: unknown[][]): (number | null)[] {
  const body = (c: unknown[] | undefined) => {
    if (!c) return null
    const b = Math.max(Number(c[1]), Number(c[4]))
    return Number.isFinite(b) && b > 0 ? b : null
  }
  return list.map((c, i) => {
    const high = Number(c[2])
    const b = body(c)
    if (!Number.isFinite(high) || high <= 0 || b === null) return null
    const around = [body(list[i - 1]), body(list[i + 1])].filter((x): x is number => x !== null)
    if (around.length && b > MAX_JUMP * Math.max(...around)) return null
    return Math.min(high, b * MAX_WICK)
  })
}

type OhlcvJson = { data?: { attributes?: { ohlcv_list?: number[][] } } }

/**
 * Velas OHLCV de un pool en GeckoTerminal, SIEMPRE con el precio en USD de
 * nuestro token (`token=<contrato>`). Sin ese parámetro GeckoTerminal usa su
 * propia "base" del pool, que en pools contra otra memecoin (OOF/RBLX,
 * JUPCAT/JUP…) puede ser el OTRO token: las velas salían con el precio de
 * RBLX (~$55) contra una entrada de $0.0001 y la call "hacía 546958x".
 * Devuelve [ms, open, high, low, close] de la más nueva a la más vieja.
 */
async function fetchCandles(
  geckoNet: string,
  pairAddress: string,
  tokenAddress: string,
  timeframe: 'minute' | 'hour' | 'day',
  opts: { beforeSec?: number; limit?: number } = {}
): Promise<number[][]> {
  const qs = new URLSearchParams({ aggregate: '1', limit: String(opts.limit ?? 1000), token: tokenAddress })
  if (opts.beforeSec) qs.set('before_timestamp', String(opts.beforeSec))
  const url = `https://api.geckoterminal.com/api/v2/networks/${geckoNet}/pools/${pairAddress}/ohlcv/${timeframe}?${qs}`
  const json = await fetchJson<OhlcvJson>(url, 7000)
  return (json?.data?.attributes?.ohlcv_list ?? [])
    .map((c) => {
      const ts = Number(c[0])
      return [ts > 1e12 ? ts : ts * 1000, Number(c[1]), Number(c[2]), Number(c[3]), Number(c[4])]
    })
    .filter((c) => c.every(Number.isFinite) && c[4] > 0)
}

/** ¿Dos precios del mismo token están en la misma escala? (sin unidades cruzadas) */
function samePriceScale(a: number, b: number, tolerance = 5): boolean {
  if (!(a > 0) || !(b > 0)) return false
  const r = a / b
  return r <= tolerance && r >= 1 / tolerance
}

/** ATH histórico vía velas diarias del par (GeckoTerminal). */
async function fetchAth(
  network: string,
  pairAddress: string,
  tokenAddress: string
): Promise<{ athPrice: number | null; athAt: number | null }> {
  const geckoNet = GECKO_NETWORK[network]
  if (!geckoNet || !pairAddress) return { athPrice: null, athAt: null }
  const candles = await fetchCandles(geckoNet, pairAddress, tokenAddress, 'day')
  let athPrice: number | null = null
  let athAt: number | null = null
  const tops = candleTops(candles)
  for (const [i, c] of candles.entries()) {
    const high = tops[i]
    if (high === null) continue
    if (athPrice === null || high > athPrice) {
      athPrice = high
      athAt = c[0]
    }
  }
  return { athPrice, athAt }
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
/**
 * Ventana de velas de minuto tras la call. GeckoTerminal da 1000 por petición;
 * con 990 queda margen para que la del minuto de la call entre en la respuesta.
 */
const MINUTE_SPAN_MS = 990 * MINUTE_MS

/**
 * Precio más alto alcanzado DESDE el momento exacto de la call (`sinceMs`),
 * no el ATH del token ni lo que hizo antes de compartirla:
 *  - Velas de MINUTO desde el minuto de la call hasta ~16 h después. De la
 *    vela del propio minuto de la call solo cuenta el cierre: su máximo pudo
 *    ocurrir segundos ANTES de compartirla.
 *  - Si la call es más vieja, velas de HORA que empiezan después de la call
 *    (nunca la hora en curso al publicarla, que incluye lo de antes).
 *  - Pasados ~41 días (fuera del alcance de las de hora), velas de DÍA, igual.
 *
 * Las velas se validan contra DexScreener antes de usarlas: la más reciente
 * tiene que estar en la escala del precio actual y la del minuto de la call en
 * la de la entrada. Si no, se descartan (pico = null): mejor sin pico que un
 * pico inventado que luego ya no baja.
 */
async function fetchPeakSince(
  network: string,
  pairAddress: string,
  tokenAddress: string,
  sinceMs: number,
  anchors: { entryPriceUsd: number; currentPriceUsd: number | null }
): Promise<{ peakPrice: number | null; peakAt: number | null }> {
  const none = { peakPrice: null, peakAt: null }
  const geckoNet = GECKO_NETWORK[network]
  if (!geckoNet || !pairAddress) return none
  const now = Date.now()
  const callMinute = Math.floor(sinceMs / MINUTE_MS) * MINUTE_MS

  const minuteEnd = Math.min(now, sinceMs + MINUTE_SPAN_MS)
  const minutes = (
    await fetchCandles(geckoNet, pairAddress, tokenAddress, 'minute', {
      beforeSec: Math.floor(minuteEnd / 1000) + 60,
    })
  ).filter((c) => c[0] >= callMinute)

  let later: number[][] = []
  if (now - sinceMs > MINUTE_SPAN_MS) {
    const firstHour = Math.floor(sinceMs / HOUR_MS) * HOUR_MS + HOUR_MS
    later = (await fetchCandles(geckoNet, pairAddress, tokenAddress, 'hour')).filter((c) => c[0] >= firstHour)
    const oldestHour = later.length ? later[later.length - 1][0] : null
    // Las de hora no llegan hasta la call (más de ~41 días): se completa con las de día
    if (oldestHour === null || oldestHour > firstHour + HOUR_MS) {
      const firstDay = Math.floor(sinceMs / DAY_MS) * DAY_MS + DAY_MS
      const days = (await fetchCandles(geckoNet, pairAddress, tokenAddress, 'day')).filter((c) => c[0] >= firstDay)
      later = [...later, ...days]
    }
  }

  const all = [...minutes, ...later]
  if (all.length === 0) return none

  // Validación de escala contra DexScreener
  const newest = all.reduce((a, b) => (b[0] > a[0] ? b : a))
  if (anchors.currentPriceUsd && now - newest[0] < 2 * HOUR_MS && !samePriceScale(newest[4], anchors.currentPriceUsd)) {
    console.warn(`[peak] velas descartadas ${tokenAddress}: último cierre ${newest[4]} vs actual ${anchors.currentPriceUsd}`)
    return none
  }
  const atCall = minutes.find((c) => c[0] === callMinute) ?? minutes[minutes.length - 1]
  if (atCall && atCall[0] - callMinute < 10 * MINUTE_MS && !samePriceScale(atCall[4], anchors.entryPriceUsd)) {
    console.warn(`[peak] velas descartadas ${tokenAddress}: cierre en la call ${atCall[4]} vs entrada ${anchors.entryPriceUsd}`)
    return none
  }

  let peakPrice: number | null = null
  let peakAt: number | null = null
  const consider = (price: number | null, at: number) => {
    if (price !== null && price > 0 && (peakPrice === null || price > peakPrice)) {
      peakPrice = price
      peakAt = at
    }
  }
  for (const list of [minutes, later]) {
    const tops = candleTops(list)
    list.forEach((c, i) => {
      // Vela del minuto de la call: solo su cierre, que ya es posterior a compartirla
      if (c[0] === callMinute) consider(c[4], sinceMs)
      else consider(tops[i], c[0])
    })
  }
  return { peakPrice, peakAt }
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

export type CallSnapshot = {
  found: boolean
  /** Red detectada a partir del par: quien da la call solo pega el CA. */
  network: string
  name: string
  symbol: string
  priceUsd: number | null
  mc: number | null
  liquidityUsd: number | null
  volume24h: number | null
  change24h: number | null
}

/**
 * Todo lo que necesita una call, con UNA sola petición a DexScreener: red,
 * nombre, símbolo y las métricas del momento.
 *
 * Existe aparte de `fetchTokenStats` porque aquélla encadena además el ATH y la
 * concentración top-10, y un bot no puede permitirse esas esperas: Discord
 * corta la interacción a los 3 segundos. Nunca lanza.
 */
export async function fetchCallSnapshot(ca: string): Promise<CallSnapshot> {
  const empty: CallSnapshot = {
    found: false, network: '', name: '', symbol: '',
    priceUsd: null, mc: null, liquidityUsd: null, volume24h: null, change24h: null,
  }
  const json = await fetchJson<{ pairs?: DexPair[] }>(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(ca)}`,
    6000
  )
  const pair = pickPair(json?.pairs ?? [], ca)
  if (!pair) return empty
  const network = NETWORK_BY_DEX_CHAIN[pair.chainId] ?? ''
  if (!network) return empty
  return {
    found: true,
    network,
    name: (pair.baseToken?.name ?? '').slice(0, 60),
    symbol: (pair.baseToken?.symbol ?? '').replace(/^\$/, '').toUpperCase().slice(0, 20),
    priceUsd: pair.priceUsd ? Number(pair.priceUsd) || null : null,
    mc: pair.marketCap ?? pair.fdv ?? null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    volume24h: pair.volume?.h24 ?? null,
    change24h: pair.priceChange?.h24 ?? null,
  }
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
  const ath = await fetchAth(network, pair.pairAddress, ca)
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
 * Precio/MC de un token AHORA MISMO (DexScreener), para guardarlo como
 * "entrada" en el instante exacto en que se publica una call — evita tener
 * que reconstruirlo después con una vela de GeckoTerminal, que puede no
 * existir aún o no alinear bien con el segundo exacto de la call.
 */
export async function fetchEntrySnapshot(
  network: string,
  ca: string
): Promise<{ priceUsd: number | null; mc: number | null }> {
  const dexChain = DEX_CHAIN[network]
  if (!dexChain) return { priceUsd: null, mc: null }
  const json = await fetchJson<{ pairs?: DexInfoPair[] }>(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(ca)}`,
    5000
  )
  const pair = pickPair(json?.pairs ?? [], ca) as DexInfoPair | null
  if (!pair) return { priceUsd: null, mc: null }
  const priceUsd = pair.priceUsd ? Number(pair.priceUsd) || null : null
  const mc = pair.marketCap ?? pair.fdv ?? null
  return { priceUsd, mc }
}

/**
 * Idealmente el precio de entrada se guardó al publicar la call (ver
 * `fetchEntrySnapshot`, capturado con hora:min:seg exactos en `createdAt`).
 * Para calls de antes de esa columna (o si el snapshot falló al publicar),
 * se reconstruye al vuelo comparando el precio actual (DexScreener) contra
 * la vela de un minuto más cercana a `calledAt` (GeckoTerminal OHLCV). Si la
 * call es tan reciente que esa vela aún no existe, se usa el precio actual
 * como entrada (0%) en vez de fallar.
 */
export async function fetchCallResult(
  network: string,
  ca: string,
  calledAt: Date,
  storedEntry?: { priceUsd: number | null; mc: number | null }
): Promise<CallResult> {
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

  const geckoNet = GECKO_NETWORK[network]
  // Fuente de verdad: el snapshot guardado al segundo exacto de la call. Solo
  // si no existe (posts de antes de esta columna, o falló al publicar) se
  // reconstruye con una vela de GeckoTerminal.
  let entryPriceUsd: number | null = storedEntry?.priceUsd ?? null
  if (entryPriceUsd === null && geckoNet && pair.pairAddress) {
    // antes de calledAt + un pequeño margen, para asegurarnos de que la vela
    // de ese minuto ya exista cuando se pide justo después de publicar
    const beforeTs = Math.floor(calledAt.getTime() / 1000) + 90
    const [c] = await fetchCandles(geckoNet, pair.pairAddress, ca, 'minute', { beforeSec: beforeTs, limit: 1 })
    if (c) entryPriceUsd = c[4]
  }
  // Call recién publicada: aún no hay vela de ese minuto. Entrada = precio
  // actual (0%) — pero solo si de verdad hay una fuente de velas para esta
  // red (si no la hay, mejor "sin datos" que fingir 0%) Y la call es de
  // verdad reciente. `fetchJson` no distingue "todavía no hay vela" de "la
  // petición a GeckoTerminal falló" (timeout, rate-limit): sin este segundo
  // chequeo, un fallo transitorio en una call vieja también caía en este
  // fallback y borraba el % real (resettéandolo a 0%) durante los 20s que
  // dura la caché de `cached()`.
  const tooRecentForCandle = Date.now() - calledAt.getTime() < 3 * 60_000
  if (entryPriceUsd === null && geckoNet && tooRecentForCandle) entryPriceUsd = currentPriceUsd

  const pctChange =
    entryPriceUsd && currentPriceUsd && entryPriceUsd > 0
      ? ((currentPriceUsd - entryPriceUsd) / entryPriceUsd) * 100
      : null

  // MC al momento de la call: el guardado al publicar si existe; si no, se
  // estima a partir del MC actual escalado por el cambio de precio (supply
  // constante).
  const entryMc =
    storedEntry?.mc ??
    (currentMc && entryPriceUsd && currentPriceUsd && currentPriceUsd > 0
      ? Math.round(currentMc * (entryPriceUsd / currentPriceUsd))
      : null)

  const multiple =
    pctChange !== null && pctChange > 0 && entryPriceUsd && currentPriceUsd
      ? currentPriceUsd / entryPriceUsd
      : null

  let peakPriceUsd: number | null = null
  let peakMc: number | null = null
  let peakAt: number | null = null
  let peakMultiple: number | null = null
  if (geckoNet && pair.pairAddress && entryPriceUsd) {
    const peak = await fetchPeakSince(network, pair.pairAddress, ca, calledAt.getTime(), { entryPriceUsd, currentPriceUsd })
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

/**
 * Holders y % del supply en el top 10 de un token (GeckoTerminal, ficha del
 * token). DexScreener no los da. null si la red no está en GeckoTerminal o
 * la petición falla; cada campo, null si GeckoTerminal no lo tiene.
 */
export async function fetchHolders(
  network: string,
  ca: string
): Promise<{ count: number | null; top10Pct: number | null } | null> {
  const geckoNet = GECKO_NETWORK[network]
  if (!geckoNet || !ca) return null
  const json = await fetchJson<{
    data?: { attributes?: { holders?: { count?: number | null; distribution_percentage?: { top_10?: string | null } } } }
  }>(`https://api.geckoterminal.com/api/v2/networks/${geckoNet}/tokens/${encodeURIComponent(ca)}/info`, 7000)
  if (!json?.data) return null
  const h = json.data.attributes?.holders
  const count = typeof h?.count === 'number' && h.count > 0 ? h.count : null
  const top10 = Number(h?.distribution_percentage?.top_10)
  return { count, top10Pct: Number.isFinite(top10) && top10 > 0 ? top10 : null }
}
