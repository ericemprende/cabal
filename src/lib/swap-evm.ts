import { ethers } from 'ethers'
import { cached } from '@/lib/cache'
import { db } from '@/lib/db'
import { awardReferralPointsForIntent, effectiveFeeBps, swapFeeConfig } from '@/lib/swap'

/**
 * Comprar el token sin salir de Cabal en redes EVM (Ethereum, Base, BNB
 * Chain), vía la API de 0x (https://0x.org/docs/api) como agregador.
 *
 * Mismo principio que swap.ts (Solana/Jupiter): Cabal solo cotiza y arma la
 * transacción; quien compra la firma con su propia wallet (MetaMask u otro
 * proveedor EIP-1193) y la manda ella misma a la red — Cabal nunca ve ni toca
 * una clave privada.
 *
 * NOTA IMPORTANTE SOBRE LA API DE 0x (v2, permit2):
 * Este módulo usa el endpoint `GET /swap/permit2/quote` de 0x v2, que es la
 * variante que Cabal necesita porque permite cobrar una comisión de afiliado
 * (`swapFeeRecipient`/`swapFeeBps`/`swapFeeToken`) sobre el token de salida,
 * igual que en Solana. Esta variante normalmente exige, además de firmar y
 * mandar la transacción, firmar un mensaje EIP-712 de Permit2 (la respuesta
 * trae `permit2.eip712`) y anexar esa firma al final de `transaction.data`,
 * precedida por su longitud codificada en 32 bytes (uint256 big-endian) —
 * así lo documenta la guía oficial de 0x para "Permit2 Signature". Esta
 * implementación sigue ese formato lo mejor que se pudo interpretar de la
 * documentación pública en el momento de escribirla, pero el formato exacto
 * de la API (nombres de campos, si el permit2 siempre viene presente, si el
 * endpoint sigue viviendo en `/swap/permit2/quote` o cambió a otra ruta de
 * v2) DEBE verificarse contra https://0x.org/docs/api antes de manejar
 * dinero real en producción — no se pudo confirmar contra la doc en vivo
 * al escribir este código.
 */

const ZEROX_BASE = 'https://api.0x.org'

/** Dirección "nativa" que usa 0x (y la mayoría de agregadores) para representar ETH/BNB nativo, no un token ERC-20. */
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEeeeeeEeeeeeeeeEEeE'

export type EvmNetwork = 'ethereum' | 'base' | 'bsc'

/** chainId numérico de cada red EVM soportada. */
export const EVM_CHAIN_ID: Record<EvmNetwork, number> = {
  ethereum: 1,
  base: 8453,
  bsc: 56,
}

/** USDC canónico en cada red (6 decimales en las tres), para cotizar el precio del nativo en USD. */
const USDC_ADDRESS: Record<EvmNetwork, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BSC USDC (18 decimales, a diferencia de las otras dos)
}
const USDC_DECIMALS: Record<EvmNetwork, number> = { ethereum: 6, base: 6, bsc: 18 }

/** RPC público por red, para leer el recibo de la transacción al confirmar. Configurable por variable de entorno. */
function rpcUrl(network: EvmNetwork): string {
  const envKey = `${network.toUpperCase()}_RPC_URL`
  const fromEnv = process.env[envKey]?.trim()
  if (fromEnv) return fromEnv
  const defaults: Record<EvmNetwork, string> = {
    ethereum: 'https://eth.llamarpc.com',
    base: 'https://mainnet.base.org',
    bsc: 'https://bsc-dataseed.binance.org',
  }
  return defaults[network]
}

const _providers = new Map<EvmNetwork, ethers.JsonRpcProvider>()
function evmProvider(network: EvmNetwork): ethers.JsonRpcProvider {
  let p = _providers.get(network)
  if (!p) {
    p = new ethers.JsonRpcProvider(rpcUrl(network), EVM_CHAIN_ID[network])
    _providers.set(network, p)
  }
  return p
}

export function isEvmNetwork(network: string): network is EvmNetwork {
  return network === 'ethereum' || network === 'base' || network === 'bsc'
}

export class InvalidBuyEvmError extends Error {}
export class InvalidConfirmEvmError extends Error {}

function zeroxApiKey(): string {
  const key = process.env.ZEROX_API_KEY?.trim()
  if (!key) throw new InvalidBuyEvmError('La compra en esta red no está configurada todavía (falta ZEROX_API_KEY)')
  return key
}

type ZeroxPermit2Eip712 = {
  types: Record<string, { name: string; type: string }[]>
  domain: Record<string, unknown>
  message: Record<string, unknown>
  primaryType: string
}

type ZeroxQuote = {
  transaction: { to: string; data: string; value: string; gas?: string; gasPrice?: string }
  permit2?: { eip712: ZeroxPermit2Eip712 }
  buyAmount: string
  sellAmount: string
  minBuyAmount?: string
  totalNetworkFee?: string
  issues?: unknown
  liquidityAvailable?: boolean
}

async function zeroxQuote(opts: {
  network: EvmNetwork
  sellToken: string
  buyToken: string
  sellAmount: string
  taker: string
  swapFeeRecipient?: string
  swapFeeBps?: number
  swapFeeToken?: string
}): Promise<ZeroxQuote> {
  const qs = new URLSearchParams({
    chainId: String(EVM_CHAIN_ID[opts.network]),
    sellToken: opts.sellToken,
    buyToken: opts.buyToken,
    sellAmount: opts.sellAmount,
    taker: opts.taker,
    ...(opts.swapFeeRecipient ? { swapFeeRecipient: opts.swapFeeRecipient } : {}),
    ...(opts.swapFeeBps ? { swapFeeBps: String(opts.swapFeeBps) } : {}),
    ...(opts.swapFeeToken ? { swapFeeToken: opts.swapFeeToken } : {}),
  })
  const res = await fetch(`${ZEROX_BASE}/swap/permit2/quote?${qs}`, {
    headers: { '0x-api-key': zeroxApiKey(), '0x-version': 'v2' },
    signal: AbortSignal.timeout(10_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.reason || json?.error || `0x no pudo cotizar (${res.status})`)
  if (json.liquidityAvailable === false) throw new InvalidBuyEvmError('No hay suficiente liquidez para este token todavía')
  return json as ZeroxQuote
}

/** Precio del nativo (ETH/BNB) de cada red en USD, a partir de una cotización real de 0x. Cacheado 20s como solPriceUsd(). */
export async function nativePriceUsd(network: EvmNetwork): Promise<number> {
  return cached(`swap-evm:native-price:${network}`, 20, async () => {
    const quote = await zeroxQuote({
      network,
      sellToken: NATIVE_TOKEN_ADDRESS,
      buyToken: USDC_ADDRESS[network],
      sellAmount: String(BigInt('1000000000000000000')), // 1 unidad del nativo (18 decimales)
      taker: NATIVE_TOKEN_ADDRESS, // dirección cualquiera válida; no se firma nada aquí, solo se cotiza
    })
    return Number(quote.buyAmount) / 10 ** USDC_DECIMALS[network]
  })
}

/**
 * Transacción a firmar en el navegador, más — si 0x pidió permit2 — el typed
 * data que hay que firmar con eth_signTypedData_v4 ANTES de mandarla (la
 * firma se concatena a `transaction.data`, ver `attachPermit2Signature` que
 * el cliente debe implementar siguiendo la doc de 0x).
 */
export type EvmTxToSign = { to: string; data: string; value: string; chainId: number }

type BuildBuyEvmResult = {
  transaction: EvmTxToSign
  permit2Eip712: ZeroxPermit2Eip712 | null
  buyAmount: string
  intentId: string | null
}

export async function buildBuyTransactionEvm(opts: {
  network: EvmNetwork
  outputToken: string
  amountUsd: number
  userAddress: string
}): Promise<BuildBuyEvmResult> {
  if (!(opts.amountUsd >= 1 && opts.amountUsd <= 50_000)) {
    throw new InvalidBuyEvmError('El monto tiene que estar entre $1 y $50,000')
  }
  if (!ethers.isAddress(opts.userAddress) || !ethers.isAddress(opts.outputToken)) {
    throw new InvalidBuyEvmError('Wallet o contrato no válidos')
  }

  const fee = await swapFeeConfig(opts.network)
  const feeBps = fee ? effectiveFeeBps(fee, opts.amountUsd) : 0

  const price = await nativePriceUsd(opts.network)
  const sellAmount = BigInt(Math.round((opts.amountUsd / price) * 1e18))
  if (sellAmount < BigInt(1000)) throw new InvalidBuyEvmError('El monto es demasiado pequeño')

  const quote = await zeroxQuote({
    network: opts.network,
    sellToken: NATIVE_TOKEN_ADDRESS,
    buyToken: opts.outputToken,
    sellAmount: sellAmount.toString(),
    taker: opts.userAddress,
    ...(fee?.feeWallet && feeBps
      ? { swapFeeRecipient: fee.feeWallet, swapFeeBps: feeBps, swapFeeToken: opts.outputToken }
      : {}),
  })

  const feeUsd = feeBps ? (opts.amountUsd * feeBps) / 10_000 : 0
  const intent =
    feeUsd > 0
      ? await db.swapIntent.create({
          data: {
            network: opts.network,
            kind: 'buy',
            walletAddress: opts.userAddress,
            mint: opts.outputToken,
            amountUsd: opts.amountUsd,
            feeUsd,
          },
        })
      : null

  return {
    transaction: {
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value,
      chainId: EVM_CHAIN_ID[opts.network],
    },
    permit2Eip712: quote.permit2?.eip712 ?? null,
    buyAmount: quote.buyAmount,
    intentId: intent?.id ?? null,
  }
}

/**
 * Confirma que una intención de compra EVM de verdad se ejecutó en la
 * blockchain (recibo con status=1) y que la mandó la wallet de la intención,
 * antes de dar puntos de referido — mismo propósito que confirmSwapIntent,
 * pero verificando contra un RPC EVM en vez del RPC de Solana.
 */
export async function confirmSwapIntentEvm(opts: { intentId: string; network: EvmNetwork; txHash: string }): Promise<{ pointsAwarded: number }> {
  const intent = await db.swapIntent.findUnique({ where: { id: opts.intentId } })
  if (!intent) throw new InvalidConfirmEvmError('Esa intención de compra no existe')
  if (intent.network !== opts.network) throw new InvalidConfirmEvmError('La red no coincide con la intención')
  if (intent.consumed) return { pointsAwarded: 0 } // ya se contó una vez, no se duplica

  const provider = evmProvider(opts.network)
  let receipt: ethers.TransactionReceipt | null = null
  for (let i = 0; i < 6 && !receipt; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2500))
    receipt = await provider.getTransactionReceipt(opts.txHash).catch(() => null)
  }
  if (!receipt || receipt.status !== 1) throw new InvalidConfirmEvmError('Esa transacción no se confirmó en la red')
  if (receipt.from.toLowerCase() !== intent.walletAddress.toLowerCase()) {
    throw new InvalidConfirmEvmError('La transacción no es de esa wallet')
  }

  return awardReferralPointsForIntent(intent)
}
