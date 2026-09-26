import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { ReferralProvider } from '@jup-ag/referral-sdk'
import { cached } from '@/lib/cache'
import { db } from '@/lib/db'
import { awardPoints, swapReferralPointsFor, tradeCashbackPointsFor } from '@/lib/api-helpers'

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

export type SwapFeeConfig = {
  referralAccount: string
  feeBps: number
  smallTradeUsd: number
  smallTradeFeeBps: number
  feeWallet: string
  note: string
}

const DEFAULT_FEE_BPS = 35

/**
 * Comisión configurada para una red, desde el panel de admin. Si no hay fila
 * en la base todavía, cae a las variables de entorno (solo definidas para
 * Solana, de cuando esto no era editable) — así ninguna comisión ya
 * configurada se cae sola con este cambio.
 */
export async function swapFeeConfig(network: string): Promise<SwapFeeConfig | null> {
  const row = await db.swapFeeConfig.findUnique({ where: { network } })
  if (row) {
    // Solana (Jupiter) cobra a través de la cuenta de referido: sin ella no
    // hay dónde cobrar. Las redes EVM (0x) no usan ese campo — ahí cobran
    // directo a `feeWallet` (swapFeeRecipient), así que lo que hace falta es
    // esa wallet, no la cuenta de referido.
    const hasPayee = network === 'solana' ? !!row.referralAccount : !!row.feeWallet
    if (!row.enabled || !hasPayee) return null
    return {
      referralAccount: row.referralAccount,
      feeBps: row.feeBps,
      smallTradeUsd: row.smallTradeUsd,
      smallTradeFeeBps: row.smallTradeFeeBps,
      feeWallet: row.feeWallet,
      note: row.note,
    }
  }
  if (network !== 'solana') return null
  const referralAccount = process.env.JUPITER_REFERRAL_ACCOUNT?.trim()
  if (!referralAccount) return null
  const feeBps = Math.round(Number(process.env.SOLANA_FEE_BPS ?? DEFAULT_FEE_BPS))
  return {
    referralAccount,
    feeBps: Number.isFinite(feeBps) && feeBps > 0 ? feeBps : DEFAULT_FEE_BPS,
    smallTradeUsd: 0,
    smallTradeFeeBps: 0,
    feeWallet: process.env.SOLANA_FEE_WALLET?.trim() ?? '',
    note: '',
  }
}

/** La comisión efectiva para un monto dado: la mínima si es una operación chiquita, la estándar si no. */
export function effectiveFeeBps(fee: SwapFeeConfig, amountUsd: number): number {
  if (fee.smallTradeUsd > 0 && amountUsd < fee.smallTradeUsd) return fee.smallTradeFeeBps
  return fee.feeBps
}

let _connection: Connection | null = null
export function solanaConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(process.env.SOLANA_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com', 'confirmed')
  }
  return _connection
}

let _referral: ReferralProvider | null = null
export function referralProvider(): ReferralProvider {
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
  /** Para pasarlo a POST /api/swap/confirm una vez la transacción esté en la red. */
  intentId: string | null
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
  /** Valor en USD de la operación, para saber si aplica la comisión mínima de operaciones chiquitas. */
  amountUsd: number
  kind: 'buy' | 'sell'
  /** El token que se está tradeando (no SOL): outputMint al comprar, inputMint al vender. */
  tradedMint: string
}): Promise<SwapBuildResult> {
  const outputMint = new PublicKey(opts.outputMint)
  const fee = await swapFeeConfig('solana')
  const feeBps = fee ? effectiveFeeBps(fee, opts.amountUsd) : undefined
  const quote = await jupQuote({
    inputMint: opts.inputMint,
    outputMint: opts.outputMint,
    amount: opts.amount,
    slippageBps: 150, // 1.5%: los memecoins recién lanzados se mueven rápido
    platformFeeBps: feeBps,
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

  // Feo aproximado (no exacto: ignora impacto de precio/slippage), pero de
  // sobra para decidir cuántos puntos gana el referido del trader — no es
  // contabilidad de plata real, es solo el bono en puntos.
  const feeUsd = feeBps ? (opts.amountUsd * feeBps) / 10_000 : 0
  const intent =
    feeUsd > 0
      ? await db.swapIntent.create({
          data: {
            network: 'solana',
            kind: opts.kind,
            walletAddress: opts.trader.toBase58(),
            mint: opts.tradedMint,
            amountUsd: opts.amountUsd,
            feeUsd,
            feeAccount: feeAccount ?? null,
          },
        })
      : null

  return {
    createFeeAccountTx,
    swapTransaction: { kind: 'versioned', base64: swapTransaction },
    outAmount: quote.outAmount,
    priceImpactPct: quote.priceImpactPct,
    intentId: intent?.id ?? null,
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

  const result = await buildSwapTransactions({
    inputMint: SOL_MINT,
    outputMint: opts.outputMint,
    amount: lamports,
    trader: buyer,
    amountUsd: opts.amountUsd,
    kind: 'buy',
    tradedMint: opts.outputMint,
  })
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

  // Para saber si aplica la comisión mínima de operaciones chiquitas hace
  // falta saber cuánto vale esto en dólares — se estima con una cotización
  // rápida sin comisión (buildSwapTransactions cotiza de nuevo, ya con la
  // comisión correcta, para armar la transacción real).
  const price = await solPriceUsd()
  const estimate = await jupQuote({ inputMint: opts.inputMint, outputMint: SOL_MINT, amount, slippageBps: 150 })
  const amountUsd = (Number(estimate.outAmount) / 1e9) * price

  const result = await buildSwapTransactions({
    inputMint: opts.inputMint,
    outputMint: SOL_MINT,
    amount,
    trader: seller,
    amountUsd,
    kind: 'sell',
    tradedMint: opts.inputMint,
  })
  return { ...result, amountIn: String(amount) }
}

export class InvalidConfirmError extends Error {}

/**
 * Confirma que una intención de swap (de buildBuy/buildSellTransactions) de
 * verdad se ejecutó en la blockchain, y si quien la hizo fue invitado por
 * alguien, le da puntos a ese invitador — en vez de repartir la comisión en
 * dinero de verdad (que exigiría que Cabal custodie fondos para pagar
 * automático a cada referido), se reparte en puntos. Sin esta verificación,
 * cualquiera podría llamar a /api/swap/build sin firmar ni mandar nada y
 * "farmear" puntos para su referido.
 */
export async function confirmSwapIntent(opts: { intentId: string; signature: string }): Promise<{ pointsAwarded: number }> {
  const intent = await db.swapIntent.findUnique({ where: { id: opts.intentId } })
  if (!intent) throw new InvalidConfirmError('Esa intención de compra/venta no existe')
  if (intent.consumed) return { pointsAwarded: 0 } // ya se contó una vez, no se duplica
  if (intentExpired(intent.createdAt)) throw new InvalidConfirmError('Esa intención de compra/venta caducó')
  if (!intent.feeAccount) throw new InvalidConfirmError('Esa intención no lleva comisión de Cabal')

  // La transacción tiene que existir en la red, haber corrido sin error, y
  // ser justo la wallet que pidió esta intención la que la firmó — si no,
  // cualquiera podría mandar la firma de una transacción ajena. Justo después
  // de mandarla puede que la red todavía no la tenga confirmada, así que se
  // reintenta unos segundos antes de rendirse.
  let tx: Awaited<ReturnType<Connection['getTransaction']>> = null
  for (let i = 0; i < 6 && !tx; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2500))
    tx = await solanaConnection()
      .getTransaction(opts.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
      .catch(() => null)
  }
  if (!tx || tx.meta?.err) throw new InvalidConfirmError('Esa transacción no se confirmó en la red')
  const signer = tx.transaction.message.staticAccountKeys?.[0]?.toBase58()
  if (signer !== intent.walletAddress) throw new InvalidConfirmError('La transacción no es de esa wallet')

  // La comisión tuvo que caer de verdad en la cuenta de cobro de Cabal. Sin
  // esto, cualquier transacción de esa wallet (mandarse 0.001 SOL a sí misma)
  // valía para confirmar una intención de $10,000 que nunca se firmó.
  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses })
  let feeIndex = -1
  for (let i = 0; i < keys.length; i++) {
    if (keys.get(i)?.toBase58() === intent.feeAccount) feeIndex = i
  }
  const rawAt = (list: { accountIndex: number; uiTokenAmount: { amount: string } }[] | null | undefined) =>
    BigInt(list?.find((b) => b.accountIndex === feeIndex)?.uiTokenAmount.amount ?? '0')
  const feeRaw = feeIndex < 0 ? BigInt(0) : rawAt(tx.meta?.postTokenBalances) - rawAt(tx.meta?.preTokenBalances)
  if (feeRaw <= BigInt(0)) throw new InvalidConfirmError('Esa transacción no es un swap de Cabal')

  let feeUsd = intent.feeUsd
  if (intent.kind === 'sell') {
    // Al vender la comisión cae en SOL: se sabe exactamente cuánto se cobró.
    feeUsd = Math.min(feeUsd, (Number(feeRaw) / 1e9) * (await solPriceUsd()))
  } else {
    // Al comprar cae en el token comprado; se comprueba el tamaño por el SOL
    // que de verdad salió de la wallet (al menos la mitad de lo declarado).
    const spentSol = ((tx.meta?.preBalances[0] ?? 0) - (tx.meta?.postBalances[0] ?? 0)) / 1e9
    const spentUsd = spentSol * (await solPriceUsd())
    if (spentUsd < intent.amountUsd * 0.5) throw new InvalidConfirmError('El monto de la transacción no coincide')
    feeUsd = Math.min(feeUsd, (spentUsd * intent.feeUsd) / intent.amountUsd)
  }

  return awardReferralPointsForIntent({ ...intent, feeUsd }, opts.signature)
}

/** Las intenciones valen 10 minutos: después ya no se pueden confirmar. */
export const SWAP_INTENT_TTL_MS = 10 * 60 * 1000
export function intentExpired(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > SWAP_INTENT_TTL_MS
}

/**
 * Última parte, compartida, de confirmar una intención de swap: marcarla
 * consumida y, si quien operó fue invitado por alguien, darle puntos a ese
 * invitador. La usan tanto confirmSwapIntent (Solana) como
 * confirmSwapIntentEvm (Ethereum/Base/BNB Chain) — cada una ya validó, a su
 * manera, que la transacción de verdad corrió on-chain y que la firmó la
 * wallet de la intención; esta parte de aquí en adelante es idéntica.
 */
export async function awardReferralPointsForIntent(intent: {
  id: string
  network: string
  walletAddress: string
  kind: string
  feeUsd: number
}, txSignature: string): Promise<{ pointsAwarded: number }> {
  // Se marca consumida y se guarda la firma en un solo paso atómico: si otra
  // petición ya la consumió, o esa firma ya confirmó otra intención (índice
  // único), no se dan puntos dos veces.
  try {
    const { count } = await db.swapIntent.updateMany({
      where: { id: intent.id, consumed: false },
      data: { consumed: true, txSignature },
    })
    if (count === 0) return { pointsAwarded: 0 }
  } catch {
    throw new InvalidConfirmError('Esa transacción ya se usó para confirmar otra compra/venta')
  }

  const wallet = await db.walletLink.findFirst({ where: { network: intent.network, address: intent.walletAddress } })
  const trader = wallet ? await db.user.findUnique({ where: { id: wallet.userId }, select: { id: true, referredById: true } }) : null
  if (!trader) return { pointsAwarded: 0 } // wallet sin cuenta vinculada

  // Cashback: una parte de la comisión vuelve en puntos al propio trader.
  const cashback = await tradeCashbackPointsFor(intent.feeUsd)
  if (cashback > 0) {
    await awardPoints(trader.id, 'trade_cashback', `${intent.kind === 'buy' ? 'Compra' : 'Venta'} en Cabal`, cashback)
  }

  if (!trader.referredById) return { pointsAwarded: 0 } // nadie lo invitó

  const points = await swapReferralPointsFor(intent.feeUsd)
  if (points <= 0) return { pointsAwarded: 0 }
  await awardPoints(
    trader.referredById,
    'swap_referral',
    `${intent.kind === 'buy' ? 'Compra' : 'Venta'} de tu invitado en Cabal`,
    points,
    trader.id
  )
  return { pointsAwarded: points }
}
