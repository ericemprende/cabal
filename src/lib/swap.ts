import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { ReferralProvider } from '@jup-ag/referral-sdk'
import { cached } from '@/lib/cache'

/**
 * Comprar el token sin salir de Cabal (Solana, vía la API de Jupiter).
 *
 * Cabal solo cotiza y arma la transacción; quien compra la firma con su
 * propia wallet (Phantom) y la manda ella misma a la red — Cabal nunca ve ni
 * toca una clave privada.
 *
 * Cómo cobra la comisión: la API de Jupiter la descuenta del lado de SALIDA
 * del swap (el token que se compra, no el SOL que se paga) — comprobado con
 * una cotización real: platformFeeBps=37 sobre una compra devolvió
 * platformFee.feeBps=37 calculado sobre outAmount. Como cada launch es un
 * token nuevo, hace falta una "cuenta de cobro" (un token account) para ESE
 * token en concreto antes de poder cobrar en él — no se puede crear de
 * antemano para todos los tokens que existirán. `buildSwap()` la crea sola,
 * la primera vez que alguien compra ese token, pagada por quien compra (el
 * mismo wallet que ya va a pagar el swap): un par de centavos de alquiler de
 * cuenta, una sola vez por token, nunca más para los siguientes compradores.
 */

const JUP_BASE = 'https://lite-api.jup.ag'
export const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export type SwapFeeConfig = { referralAccount: string; feeBps: number }

const DEFAULT_FEE_BPS = 35

export function swapFeeConfig(): SwapFeeConfig | null {
  const referralAccount = process.env.JUPITER_REFERRAL_ACCOUNT?.trim()
  if (!referralAccount) return null
  const feeBps = Math.round(Number(process.env.SOLANA_FEE_BPS ?? DEFAULT_FEE_BPS))
  return { referralAccount, feeBps: Number.isFinite(feeBps) && feeBps > 0 ? feeBps : DEFAULT_FEE_BPS }
}

/** Wallet a la que apunta la comisión, solo para mostrarla en el panel de admin. */
export function feeWalletHint(): string | null {
  return process.env.SOLANA_FEE_WALLET?.trim() || null
}

let _connection: Connection | null = null
export function solanaConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(process.env.SOLANA_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com', 'confirmed')
  }
  return _connection
}

let _referral: ReferralProvider | null = null
function referralProvider(): ReferralProvider {
  if (!_referral) _referral = new ReferralProvider(solanaConnection())
  return _referral
}

/** Precio de SOL en USD, a partir de una cotización real (no un feed aparte que pueda desincronizarse). */
export async function solPriceUsd(): Promise<number> {
  return cached('swap:sol-price', 20, async () => {
    const quote = await jupQuote({ inputMint: SOL_MINT, outputMint: USDC_MINT, amount: 1_000_000_000, slippageBps: 50 })
    return Number(quote.outAmount) / 1e6 // USDC tiene 6 decimales
  })
}

type JupQuoteParams = {
  inputMint: string
  outputMint: string
  amount: number
  slippageBps: number
  platformFeeBps?: number
}

export type JupQuote = {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  otherAmountThreshold: string
  slippageBps: number
  platformFee: { amount: string; feeBps: number } | null
  priceImpactPct: string
  [key: string]: unknown
}

async function jupQuote(params: JupQuoteParams): Promise<JupQuote> {
  const qs = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: String(params.amount),
    slippageBps: String(params.slippageBps),
    ...(params.platformFeeBps ? { platformFeeBps: String(params.platformFeeBps) } : {}),
  })
  const res = await fetch(`${JUP_BASE}/swap/v1/quote?${qs}`, { signal: AbortSignal.timeout(10_000) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || `Jupiter no pudo cotizar (${res.status})`)
  return json as JupQuote
}

async function jupBuildSwap(body: Record<string, unknown>): Promise<{ swapTransaction: string }> {
  const res = await fetch(`${JUP_BASE}/swap/v1/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.swapTransaction) throw new Error(json?.error || `Jupiter no pudo armar la transacción (${res.status})`)
  return json
}

export class InvalidBuyError extends Error {}
export class InvalidSellError extends Error {}

/**
 * Cotiza y arma la transacción de compra (más, si hace falta, la de crear la
 * cuenta de cobro de ese token). Nada de esto firma ni manda nada: solo
 * construye. El navegador de quien compra hace el resto.
 */
export type SerializedTx = { kind: 'legacy' | 'versioned'; base64: string }

type SwapBuildResult = {
  createFeeAccountTx: SerializedTx | null
  swapTransaction: SerializedTx
  outAmount: string
  priceImpactPct: string
}

/**
 * Núcleo compartido por comprar y vender: cotiza `inputMint` → `outputMint`
 * por `amount` (unidades base del mint de entrada) y arma la transacción de
 * swap, creando de paso — si hace falta — la cuenta donde Jupiter deposita
 * la comisión de Cabal en el mint de SALIDA de este swap en concreto.
 */
async function buildSwapTransactions(opts: {
  inputMint: string
  outputMint: string
  amount: number
  trader: PublicKey
}): Promise<SwapBuildResult> {
  const outputMint = new PublicKey(opts.outputMint)
  const fee = swapFeeConfig()
  const quote = await jupQuote({
    inputMint: opts.inputMint,
    outputMint: opts.outputMint,
    amount: opts.amount,
    slippageBps: 150, // 1.5%: los memecoins recién lanzados se mueven rápido
    platformFeeBps: fee?.feeBps,
  })

  let feeAccount: string | undefined
  let createFeeAccountTx: SerializedTx | null = null
  if (fee) {
    const referralAccountPubKey = new PublicKey(fee.referralAccount)
    const feeAccountPubKey = referralProvider().getReferralTokenAccountPubKey({ referralAccountPubKey, mint: outputMint })
    feeAccount = feeAccountPubKey.toBase58()
    const info = await solanaConnection().getAccountInfo(feeAccountPubKey).catch(() => null)
    if (!info) {
      // Primer swap de Cabal que entrega ESE mint (comprándolo, o vendiendo a
      // SOL): hace falta crear la cuenta donde cae la comisión. La paga quien
      // opera, con su propia wallet — es una sola vez por mint, nunca más.
      const { tx } = await referralProvider().initializeReferralTokenAccount({
        payerPubKey: opts.trader,
        referralAccountPubKey,
        mint: outputMint,
      })
      tx.feePayer = opts.trader
      const { blockhash } = await solanaConnection().getLatestBlockhash()
      tx.recentBlockhash = blockhash
      createFeeAccountTx = { kind: 'legacy', base64: tx.serialize({ requireAllSignatures: false }).toString('base64') }
    }
  }

  const { swapTransaction } = await jupBuildSwap({
    quoteResponse: quote,
    userPublicKey: opts.trader.toBase58(),
    ...(feeAccount ? { feeAccount } : {}),
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: { priorityLevelWithMaxLamports: { priorityLevel: 'medium', maxLamports: 2_000_000 } },
  })

  // Defensa en profundidad: si Jupiter alguna vez devolviera algo que no
  // deserializa, mejor que reviente aquí (error 502) que mandarle al
  // navegador de quien opera un base64 que no es de verdad una transacción.
  VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'))

  return {
    createFeeAccountTx,
    swapTransaction: { kind: 'versioned', base64: swapTransaction },
    outAmount: quote.outAmount,
    priceImpactPct: quote.priceImpactPct,
  }
}

export async function buildBuyTransactions(opts: {
  outputMint: string
  amountUsd: number
  userPublicKey: string
}): Promise<SwapBuildResult & { lamportsIn: string }> {
  if (!(opts.amountUsd >= 1 && opts.amountUsd <= 50_000)) {
    throw new InvalidBuyError('El monto tiene que estar entre $1 y $50,000')
  }
  let buyer: PublicKey
  try {
    buyer = new PublicKey(opts.userPublicKey)
    void new PublicKey(opts.outputMint)
  } catch {
    throw new InvalidBuyError('Wallet o contrato no válidos')
  }

  const price = await solPriceUsd()
  const lamports = Math.round((opts.amountUsd / price) * 1e9)
  if (lamports < 1000) throw new InvalidBuyError('El monto es demasiado pequeño')

  const result = await buildSwapTransactions({ inputMint: SOL_MINT, outputMint: opts.outputMint, amount: lamports, trader: buyer })
  return { ...result, lamportsIn: String(lamports) }
}

/** Balance de un mint SPL (o de SOL) en una wallet, en unidades base y legibles. */
export async function tokenBalance(opts: { owner: string; mint: string }): Promise<{ amount: string; decimals: number; uiAmount: number }> {
  const owner = new PublicKey(opts.owner)
  if (opts.mint === SOL_MINT) {
    const lamports = await solanaConnection().getBalance(owner)
    return { amount: String(lamports), decimals: 9, uiAmount: lamports / 1e9 }
  }
  const mint = new PublicKey(opts.mint)
  const accounts = await solanaConnection().getParsedTokenAccountsByOwner(owner, { mint })
  const total = accounts.value.reduce((sum, { account }) => {
    const info = account.data.parsed?.info?.tokenAmount
    return sum + BigInt(info?.amount ?? '0')
  }, BigInt(0))
  const decimals = accounts.value[0]?.account.data.parsed?.info?.tokenAmount?.decimals ?? 0
  return { amount: total.toString(), decimals, uiAmount: Number(total) / 10 ** decimals }
}

export async function buildSellTransactions(opts: {
  inputMint: string
  percent: number
  userPublicKey: string
}): Promise<SwapBuildResult & { amountIn: string }> {
  if (!(opts.percent > 0 && opts.percent <= 100)) {
    throw new InvalidSellError('El porcentaje a vender no es válido')
  }
  let seller: PublicKey
  try {
    seller = new PublicKey(opts.userPublicKey)
    void new PublicKey(opts.inputMint)
  } catch {
    throw new InvalidSellError('Wallet o contrato no válidos')
  }

  const balance = await tokenBalance({ owner: opts.userPublicKey, mint: opts.inputMint })
  const amount = Math.floor((Number(balance.amount) * opts.percent) / 100)
  if (amount < 1) throw new InvalidSellError('No tienes saldo de este token para vender')

  const result = await buildSwapTransactions({ inputMint: opts.inputMint, outputMint: SOL_MINT, amount, trader: seller })
  return { ...result, amountIn: String(amount) }
}
