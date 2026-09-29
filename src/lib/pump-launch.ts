import BN from 'bn.js'
import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from '@solana/web3.js'
import { NATIVE_MINT } from '@solana/spl-token'
import { OnlinePumpSdk, PUMP_SDK, bondingCurvePda, getBuyTokenAmountFromSolAmount } from '@pump-fun/pump-sdk'
import { db } from '@/lib/db'
import { solanaConnection } from '@/lib/swap'
import { siteUrl } from '@/lib/waitlist'

/**
 * Lanzar un token en pump.fun desde Cabal, con el SDK oficial de pump.fun.
 *
 * Igual que la compra con Jupiter (lib/swap.ts): Cabal solo arma las
 * transacciones. Las firman el creador con su wallet y la clave del token
 * nuevo, que se genera en el navegador y nunca llega al servidor.
 *
 * El metadata (nombre, imagen, redes) no lo sube el SDK: lo sirve Cabal en
 * /api/pump/meta/<mint> desde la tabla PumpCoin, y esa URL es la `uri` que
 * queda grabada en el token.
 */

export const PUMP_LIMITS = { name: 32, symbol: 10, description: 1000, maxInitialBuySol: 50 }

/**
 * Comisión de Cabal por cada lanzamiento: SOL fijos a una wallet. Se edita en
 * /admin → Comisiones y vive en la tabla Setting; sin fila, estos valores.
 */
export const PUMP_FEE_KEYS = { sol: 'pump_launch_fee_sol', wallet: 'pump_launch_fee_wallet' } as const
export const PUMP_FEE_DEFAULT = { sol: 0.025, wallet: '9nHveRiAQSvAtwAKCojbmu32yxdKP246Z7cuoHX8pDk8' }

export type PumpLaunchFee = { sol: number; wallet: string }

export async function pumpLaunchFee(): Promise<PumpLaunchFee> {
  const rows = await db.setting
    .findMany({ where: { key: { in: [PUMP_FEE_KEYS.sol, PUMP_FEE_KEYS.wallet] } } })
    .catch(() => [] as { key: string; value: string }[])
  const get = (k: string) => rows.find((r) => r.key === k)?.value
  const sol = Number(get(PUMP_FEE_KEYS.sol) ?? PUMP_FEE_DEFAULT.sol)
  return {
    sol: Number.isFinite(sol) && sol > 0 ? sol : 0,
    wallet: get(PUMP_FEE_KEYS.wallet) ?? PUMP_FEE_DEFAULT.wallet,
  }
}

function toPubkey(w: string): PublicKey | null {
  try {
    return w ? new PublicKey(w) : null
  } catch {
    return null
  }
}

export function metadataUri(mint: string): string {
  return `${siteUrl()}/api/pump/meta/${mint}`
}

let _sdk: OnlinePumpSdk | null = null
function sdk(): OnlinePumpSdk {
  if (!_sdk) _sdk = new OnlinePumpSdk(solanaConnection())
  return _sdk
}

/**
 * Transacciones sin firmar (base64) para lanzar el token. La primera crea el
 * token y es la única que firma también el mint. Si hay compra inicial va en
 * una segunda: crear + comprar juntos pasan del tamaño máximo de una
 * transacción de Solana (1232 bytes, comprobado contra mainnet). La wallet
 * firma las dos de una vez y el servidor manda la compra justo al confirmarse
 * la creación. La comisión de Cabal, si hay, va en la última.
 */
export async function buildCreateTxs(p: {
  mint: string
  creator: string
  name: string
  symbol: string
  initialBuySol: number
}): Promise<{ txs: string[]; feeSol: number }> {
  const mint = new PublicKey(p.mint)
  const creator = new PublicKey(p.creator)
  const meta = { mint, name: p.name, symbol: p.symbol, uri: metadataUri(p.mint), creator, user: creator, mayhemMode: false }

  const groups: TransactionInstruction[][] = []
  if (p.initialBuySol > 0) {
    const [global, feeConfig] = await Promise.all([sdk().fetchGlobal(), sdk().fetchFeeConfig()])
    const solAmount = new BN(Math.round(p.initialBuySol * LAMPORTS_PER_SOL))
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: null,
      bondingCurve: null,
      amount: solAmount,
      quoteMint: NATIVE_MINT,
    })
    // [create_v2, ATA del creador, buy]: se parte tras el create
    const [create, ...buy] = await PUMP_SDK.createV2AndBuyInstructions({ ...meta, global, amount, solAmount })
    groups.push([create], buy)
  } else {
    groups.push([await PUMP_SDK.createV2Instruction(meta)])
  }

  const fee = await pumpLaunchFee()
  const feeSol = fee.sol
  const to = toPubkey(fee.wallet)
  if (feeSol > 0 && to) {
    groups[groups.length - 1].push(
      SystemProgram.transfer({ fromPubkey: creator, toPubkey: to, lamports: Math.round(feeSol * LAMPORTS_PER_SOL) }),
    )
  }

  const { blockhash } = await solanaConnection().getLatestBlockhash('confirmed')
  const txs = groups.map((ixs) => {
    const message = new TransactionMessage({
      payerKey: creator,
      recentBlockhash: blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        ...ixs,
      ],
    }).compileToV0Message()
    return Buffer.from(new VersionedTransaction(message).serialize()).toString('base64')
  })
  return { txs, feeSol: to ? feeSol : 0 }
}

async function sendAndConfirm(tx: VersionedTransaction): Promise<string> {
  const conn = solanaConnection()
  const { lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  const signature = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 })
  const res = await conn.confirmTransaction(
    { signature, blockhash: tx.message.recentBlockhash, lastValidBlockHeight },
    'confirmed',
  )
  if (res.value.err) throw new Error('La transacción falló en la red')
  return signature
}

/**
 * Manda a la red las transacciones ya firmadas, en orden y esperando a cada
 * una. Antes comprueba que las paga el creador y que la primera crea este
 * mint (no se retransmite cualquier cosa). Devuelve la firma de la creación;
 * si la compra inicial falla, el token ya existe y se avisa en `buyError`.
 */
export async function sendCreateTxs(
  signedB64: string[],
  mint: string,
  creator: string,
): Promise<{ signature: string; buyError: string | null }> {
  const txs = signedB64.slice(0, 2).map((b) => VersionedTransaction.deserialize(Buffer.from(b, 'base64')))
  if (!txs.length) throw new Error('Falta la transacción')
  for (const tx of txs) {
    if (tx.message.staticAccountKeys[0].toBase58() !== creator) throw new Error('La transacción no la paga la wallet del creador')
  }
  if (!txs[0].message.staticAccountKeys.some((k) => k.toBase58() === mint)) throw new Error('La transacción no crea este token')

  const signature = await sendAndConfirm(txs[0])
  let buyError: string | null = null
  if (txs[1]) {
    try {
      await sendAndConfirm(txs[1])
    } catch (e) {
      console.error('[pump] compra inicial', e)
      buyError = 'El token se creó, pero la compra inicial no entró. Puedes comprar desde su ficha.'
    }
  }
  return { signature, buyError }
}

/** true si el token ya existe en pump.fun (su bonding curve está en la red). */
export async function coinExistsOnChain(mint: string): Promise<boolean> {
  const info = await solanaConnection().getAccountInfo(bondingCurvePda(mint), 'confirmed')
  return Boolean(info)
}
