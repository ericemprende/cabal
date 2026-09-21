import { ethers } from 'ethers'
import { db } from '@/lib/db'
import { cached } from '@/lib/cache'
import { referralProvider, swapFeeConfig } from '@/lib/swap'
import { NATIVE_TOKEN_ADDRESS, evmProvider, isEvmNetwork, tokenValueUsd, type EvmNetwork } from '@/lib/swap-evm'

/**
 * Lo que HAY ahora mismo sin reclamar en las cuentas donde cae la comisión,
 * leído de la cadena — no el estimado que guarda SwapIntent.
 *
 * Son dos números distintos y ninguno sustituye al otro:
 *
 * - SwapIntent registra lo cobrado EN EL MOMENTO de cada operación. Es el
 *   histórico, y no se mueve nunca más.
 * - Esto de aquí es el saldo vivo. Baja a cero en cuanto se reclama, y sube y
 *   baja solo, porque la comisión se cobra en el token comprado: si el token
 *   se fue a cero, una comisión que valía $5 al operar hoy vale $0.
 *
 * Solo lectura: nada de esto firma ni mueve fondos. Reclamar se hace desde
 * referral.jup.ag (Solana) o desde la wallet directamente (EVM).
 */

const JUP_PRICE = 'https://lite-api.jup.ag/price/v3'

export type FeeBalance = {
  /** Mint (Solana) o contrato (EVM). El nativo de cada red EVM va con NATIVE_TOKEN_ADDRESS. */
  token: string
  /** Ticker si el token está en nuestra tabla Token; si no, el contrato acortado. */
  label: string
  /** Cantidad ya dividida por los decimales del token. */
  amount: number
  /** null = no se pudo cotizar (token sin liquidez): hay saldo, pero no un precio honesto que enseñar. */
  usd: number | null
}

export type NetworkTreasury = {
  network: string
  /** La cuenta de referido (Solana) o la fee wallet (EVM) de la que se leyó. */
  payee: string
  balances: FeeBalance[]
  /** Suma de los `usd` que sí se pudieron cotizar. */
  usdTotal: number
  /** Cuántos tokens tienen saldo pero no precio: el total de arriba se queda corto en esa medida. */
  unpriced: number
  /** Por qué esta red no devolvió nada (sin configurar, RPC caído…). */
  error: string | null
}

const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`

/** Ticker de cada contrato, de nuestra propia tabla de tokens — evita pedir metadatos on-chain uno a uno. */
async function tickerMap(network: string, contracts: string[]): Promise<Map<string, string>> {
  if (contracts.length === 0) return new Map()
  const rows = await db.token.findMany({
    where: { network, contract: { in: contracts } },
    select: { contract: true, ticker: true },
  })
  return new Map(rows.map((r) => [r.contract.toLowerCase(), r.ticker]))
}

/**
 * Solana: el SDK de referidos de Jupiter lista las cuentas de cobro (una por
 * mint) con su saldo, y la Price API de Jupiter les pone precio en USD —
 * devuelve también los decimales, así que no hace falta leerlos aparte.
 */
export async function solanaTreasury(): Promise<NetworkTreasury> {
  const base: NetworkTreasury = { network: 'solana', payee: '', balances: [], usdTotal: 0, unpriced: 0, error: null }
  const fee = await swapFeeConfig('solana')
  if (!fee?.referralAccount) return { ...base, error: 'Sin cuenta de referido configurada' }

  try {
    const { tokenAccounts, token2022Accounts } = await referralProvider().getReferralTokenAccounts(fee.referralAccount)
    const held = [...tokenAccounts, ...token2022Accounts]
      .map((a) => ({ mint: a.account.mint.toBase58(), raw: a.account.amount }))
      .filter((a) => a.raw > BigInt(0))
    if (held.length === 0) return { ...base, payee: fee.referralAccount }

    // La Price API acepta varios mints por llamada, pero no ilimitados: de
    // 100 en 100 para no pasarse de la longitud de URL que acepta.
    const prices = new Map<string, { usdPrice: number; decimals: number }>()
    for (let i = 0; i < held.length; i += 100) {
      const ids = held.slice(i, i + 100).map((h) => h.mint)
      const json = await cached(`swap-treasury:jup-price:${ids[0]}:${ids.length}`, 120, async () => {
        const res = await fetch(`${JUP_PRICE}?ids=${ids.join(',')}`, { signal: AbortSignal.timeout(10_000) })
        if (!res.ok) throw new Error(`Jupiter no pudo dar precios (${res.status})`)
        return (await res.json()) as Record<string, { usdPrice?: number; decimals?: number }>
      }).catch(() => ({}) as Record<string, { usdPrice?: number; decimals?: number }>)
      for (const [mint, v] of Object.entries(json)) {
        if (typeof v?.usdPrice === 'number' && typeof v?.decimals === 'number') {
          prices.set(mint, { usdPrice: v.usdPrice, decimals: v.decimals })
        }
      }
    }

    const tickers = await tickerMap('solana', held.map((h) => h.mint))
    const balances: FeeBalance[] = held.map((h) => {
      const price = prices.get(h.mint)
      const amount = price ? Number(h.raw) / 10 ** price.decimals : Number(h.raw)
      return {
        token: h.mint,
        label: tickers.get(h.mint.toLowerCase()) ?? shortAddr(h.mint),
        amount,
        usd: price ? amount * price.usdPrice : null,
      }
    })
    return summarize({ ...base, payee: fee.referralAccount, balances })
  } catch (e) {
    return { ...base, payee: fee.referralAccount, error: (e as Error).message }
  }
}

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']

/**
 * EVM: 0x no guarda registro de lo que ganó el `swapFeeRecipient` — solo le
 * manda los tokens. Así que se lee la wallet directamente. Qué tokens mirar
 * lo sabemos por nuestra propia tabla: la comisión se cobró sobre el token de
 * salida de cada swap, que es justo `SwapIntent.mint`.
 *
 * Se hace por RPC, no por explorador de bloques: Etherscan V2 no cubre Base
 * ni BNB Chain en su plan gratuito, y el Blockscout de Robinhood Chain está
 * detrás de Cloudflare. El RPC ya está configurado para las cinco redes.
 */
export async function evmTreasury(network: EvmNetwork): Promise<NetworkTreasury> {
  const base: NetworkTreasury = { network, payee: '', balances: [], usdTotal: 0, unpriced: 0, error: null }
  const fee = await swapFeeConfig(network)
  if (!fee?.feeWallet) return { ...base, error: 'Sin wallet de comisiones configurada' }
  if (!ethers.isAddress(fee.feeWallet)) return { ...base, payee: fee.feeWallet, error: 'La wallet de comisiones no es una dirección válida' }

  try {
    const provider = evmProvider(network)
    const mints = await db.swapIntent.findMany({
      where: { network, consumed: true },
      select: { mint: true },
      distinct: ['mint'],
      take: 60, // techo: son llamadas RPC + una cotización de 0x por token
    })

    const erc20 = await Promise.all(
      mints.map(async ({ mint }) => {
        if (!ethers.isAddress(mint)) return null
        try {
          const c = new ethers.Contract(mint, ERC20_ABI, provider)
          const raw = (await c.balanceOf(fee.feeWallet)) as bigint
          if (raw <= BigInt(0)) return null
          const decimals = Number((await c.decimals()) as bigint)
          return { token: mint, raw, amount: Number(raw) / 10 ** decimals }
        } catch {
          return null // contrato que no responde a balanceOf/decimals: se ignora, no rompe el resto
        }
      })
    )

    // El nativo aparte: llega ahí cuando la comisión se cobró sobre una venta
    // a ETH/BNB, y además es lo que paga el gas al mover el resto.
    const nativeRaw = await provider.getBalance(fee.feeWallet).catch(() => BigInt(0))
    const found = erc20.filter((x): x is NonNullable<typeof x> => x !== null)
    const tickers = await tickerMap(network, found.map((f) => f.token))

    const balances: FeeBalance[] = await Promise.all([
      ...found.map(async (f) => ({
        token: f.token,
        label: tickers.get(f.token.toLowerCase()) ?? shortAddr(f.token),
        amount: f.amount,
        usd: await tokenValueUsd(network, f.token, f.raw).catch(() => null),
      })),
      ...(nativeRaw > BigInt(0)
        ? [
            {
              token: NATIVE_TOKEN_ADDRESS,
              label: 'Nativo',
              amount: Number(nativeRaw) / 1e18,
              usd: await tokenValueUsd(network, NATIVE_TOKEN_ADDRESS, nativeRaw).catch(() => null),
            },
          ]
        : []),
    ])
    return summarize({ ...base, payee: fee.feeWallet, balances })
  } catch (e) {
    return { ...base, payee: fee.feeWallet, error: (e as Error).message }
  }
}

function summarize(t: NetworkTreasury): NetworkTreasury {
  const balances = [...t.balances].sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1))
  return {
    ...t,
    balances,
    usdTotal: balances.reduce((acc, b) => acc + (b.usd ?? 0), 0),
    unpriced: balances.filter((b) => b.usd === null).length,
  }
}

/** Todas las redes a la vez. Una red que falle no tumba a las demás: cada una trae su propio `error`. */
export async function allTreasuries(networks: string[]): Promise<NetworkTreasury[]> {
  return Promise.all(
    networks.map((n) => (n === 'solana' ? solanaTreasury() : isEvmNetwork(n) ? evmTreasury(n) : Promise.resolve(null)))
  ).then((rows) => rows.filter((r): r is NetworkTreasury => r !== null))
}
