import BN from 'bn.js'
import {
  ComputeBudgetProgram,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
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
import { bonkCoinExists, bonkInstructionGroups } from '@/lib/bonk-launch'
import { cabalCoinExists, cabalInstructionGroups } from '@/lib/cabal-launch'
import type { LaunchPlatformId } from '@/lib/launch-platforms'
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
 * Comisión de Cabal por cada lanzamiento: SOL fijos, uno por launchpad, a una
 * sola wallet. Se edita en /admin → Comisiones y vive en la tabla Setting
 * (`launch_fee_sol:<plataforma>`); sin fila, estos valores. Pump lee además la
 * clave antigua, de cuando solo existía pump.fun.
 */
export const LAUNCH_FEE_PLATFORMS = ['pump', 'bonk', 'cabal'] as const
export type LaunchFeePlatform = (typeof LAUNCH_FEE_PLATFORMS)[number]
export const PUMP_FEE_KEYS = { sol: 'pump_launch_fee_sol', wallet: 'pump_launch_fee_wallet' } as const
export const launchFeeKey = (platform: LaunchFeePlatform) => `launch_fee_sol:${platform}`
export const PUMP_FEE_DEFAULT = { sol: 0.025, wallet: '9nHveRiAQSvAtwAKCojbmu32yxdKP246Z7cuoHX8pDk8' }

export type PumpLaunchFee = { sol: number; wallet: string }
export type LaunchFeeSettings = { wallet: string; fees: Record<LaunchFeePlatform, number> }

export async function launchFeeSettings(): Promise<LaunchFeeSettings> {
  const rows = await db.setting
    .findMany({
      where: { key: { in: [PUMP_FEE_KEYS.sol, PUMP_FEE_KEYS.wallet, ...LAUNCH_FEE_PLATFORMS.map(launchFeeKey)] } },
    })
    .catch(() => [] as { key: string; value: string }[])
  const get = (k: string) => rows.find((r) => r.key === k)?.value
  const clean = (v: string | undefined) => {
    const n = Number(v ?? PUMP_FEE_DEFAULT.sol)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return {
    wallet: get(PUMP_FEE_KEYS.wallet) ?? PUMP_FEE_DEFAULT.wallet,
    fees: {
      pump: clean(get(launchFeeKey('pump')) ?? get(PUMP_FEE_KEYS.sol)),
      bonk: clean(get(launchFeeKey('bonk'))),
      cabal: clean(get(launchFeeKey('cabal'))),
    },
  }
}

/** Comisión de un launchpad concreto ({ sol, wallet }). */
export async function pumpLaunchFee(platform: string = 'pump'): Promise<PumpLaunchFee> {
  const s = await launchFeeSettings()
  const key = (LAUNCH_FEE_PLATFORMS as readonly string[]).includes(platform) ? (platform as LaunchFeePlatform) : 'pump'
  return { sol: s.fees[key], wallet: s.wallet }
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

/** Nonce duradero ya creado en la red: permite firmar hoy y mandar otro día. */
export type DurableNonce = { account: string; value: string }

/**
 * Transacciones sin firmar (base64) para lanzar el token. La primera crea el
 * token y es la única que firma también el mint. Si hay compra inicial va en
 * una segunda: crear + comprar juntos pasan del tamaño máximo de una
 * transacción de Solana (1232 bytes, comprobado contra mainnet). La wallet
 * firma las dos de una vez y el servidor manda la compra justo al confirmarse
 * la creación.
 *
 * - `chargeFee`: la comisión de Cabal va en la última. En los programados no,
 *   porque se cobró al programar.
 * - `nonces`: una por transacción. Con ellos las transacciones no caducan a
 *   los ~60 s (llevan `nonceAdvance` delante y el nonce como blockhash).
 */
export async function buildCreateTxs(p: {
  platform?: LaunchPlatformId
  mint: string
  creator: string
  name: string
  symbol: string
  initialBuySol: number
  chargeFee?: boolean
  nonces?: DurableNonce[]
}): Promise<{ txs: string[]; feeSol: number }> {
  const creator = new PublicKey(p.creator)
  const groups = await instructionGroups(p)

  let feeSol = 0
  if (p.chargeFee !== false) {
    const fee = await pumpLaunchFee(p.platform ?? 'pump')
    const to = toPubkey(fee.wallet)
    if (fee.sol > 0 && to) {
      feeSol = fee.sol
      groups[groups.length - 1].push(
        SystemProgram.transfer({ fromPubkey: creator, toPubkey: to, lamports: Math.round(fee.sol * LAMPORTS_PER_SOL) }),
      )
    }
  }

  if (p.nonces && p.nonces.length < groups.length) throw new Error('Faltan nonces para programar')
  const blockhash = p.nonces ? '' : (await solanaConnection().getLatestBlockhash('confirmed')).blockhash
  const txs = groups.map((ixs, i) => {
    const nonce = p.nonces?.[i]
    const message = new TransactionMessage({
      payerKey: creator,
      recentBlockhash: nonce ? nonce.value : blockhash,
      instructions: [
        // Con nonce duradero, nonceAdvance tiene que ser la primera instrucción
        ...(nonce
          ? [SystemProgram.nonceAdvance({ noncePubkey: new PublicKey(nonce.account), authorizedPubkey: creator })]
          : []),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        ...ixs,
      ],
    }).compileToV0Message()
    return Buffer.from(new VersionedTransaction(message).serialize()).toString('base64')
  })
  return { txs, feeSol }
}

/** Cuántas transacciones lleva un lanzamiento (una por nonce, al programarlo). */
export async function txCount(p: Parameters<typeof instructionGroups>[0]): Promise<number> {
  return (await instructionGroups(p)).length
}

/** Instrucciones del lanzamiento según la plataforma, agrupadas por transacción. */
async function instructionGroups(p: {
  platform?: LaunchPlatformId
  mint: string
  creator: string
  name: string
  symbol: string
  initialBuySol: number
}): Promise<TransactionInstruction[][]> {
  if (p.platform === 'bonk') {
    return bonkInstructionGroups({ ...p, uri: metadataUri(p.mint) })
  }
  if (p.platform === 'cabal') {
    return cabalInstructionGroups({ ...p, uri: metadataUri(p.mint) })
  }
  return pumpInstructionGroups(p)
}

async function pumpInstructionGroups(p: {
  mint: string
  creator: string
  name: string
  symbol: string
  initialBuySol: number
}): Promise<TransactionInstruction[][]> {
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

  return groups
}

/**
 * Primer paso de un lanzamiento programado: crea los nonces duraderos (uno por
 * transacción del lanzamiento, con el creador como autoridad) y cobra la
 * comisión de Cabal. La firman el creador y las claves de los nonces, que se
 * generan en el navegador. El alquiler de los nonces (~0,0015 SOL cada uno)
 * es del creador y lo recupera si cancela.
 */
export async function buildScheduleSetupTx(p: {
  platform?: string
  creator: string
  nonceAccounts: string[]
}): Promise<{ tx: string; feeSol: number }> {
  const creator = new PublicKey(p.creator)
  const conn = solanaConnection()
  const rent = await conn.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH)
  const ixs: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 })]
  for (const a of p.nonceAccounts) {
    const noncePubkey = new PublicKey(a)
    ixs.push(
      SystemProgram.createAccount({
        fromPubkey: creator,
        newAccountPubkey: noncePubkey,
        lamports: rent,
        space: NONCE_ACCOUNT_LENGTH,
        programId: SystemProgram.programId,
      }),
      SystemProgram.nonceInitialize({ noncePubkey, authorizedPubkey: creator }),
    )
  }
  let feeSol = 0
  const fee = await pumpLaunchFee(p.platform ?? 'pump')
  const to = toPubkey(fee.wallet)
  if (fee.sol > 0 && to) {
    feeSol = fee.sol
    ixs.push(SystemProgram.transfer({ fromPubkey: creator, toPubkey: to, lamports: Math.round(fee.sol * LAMPORTS_PER_SOL) }))
  }
  const { blockhash } = await conn.getLatestBlockhash('confirmed')
  const message = new TransactionMessage({ payerKey: creator, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message()
  return { tx: Buffer.from(new VersionedTransaction(message).serialize()).toString('base64'), feeSol }
}

/** Valor actual de cada nonce (lo que hace de blockhash en las transacciones programadas). */
export async function readNonces(accounts: string[]): Promise<DurableNonce[]> {
  const conn = solanaConnection()
  return Promise.all(
    accounts.map(async (account) => {
      const info = await conn.getAccountInfo(new PublicKey(account), 'confirmed')
      if (!info) throw new Error('El nonce todavía no está en la red')
      return { account, value: NonceAccount.fromAccountData(info.data).nonce }
    }),
  )
}

/**
 * Cancelar un programado o recuperar el alquiler tras lanzar: retira todo el
 * saldo de los nonces a la wallet del creador, lo que además los cierra y
 * deja inservibles las transacciones guardadas.
 */
export async function buildNonceWithdrawTx(creator: string, accounts: string[]): Promise<string> {
  const owner = new PublicKey(creator)
  const conn = solanaConnection()
  const ixs: TransactionInstruction[] = []
  for (const a of accounts) {
    const noncePubkey = new PublicKey(a)
    const lamports = await conn.getBalance(noncePubkey, 'confirmed')
    if (lamports > 0) {
      ixs.push(SystemProgram.nonceWithdraw({ noncePubkey, authorizedPubkey: owner, toPubkey: owner, lamports }))
    }
  }
  if (!ixs.length) throw new Error('No queda nada que retirar')
  const { blockhash } = await conn.getLatestBlockhash('confirmed')
  const message = new TransactionMessage({ payerKey: owner, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message()
  return Buffer.from(new VersionedTransaction(message).serialize()).toString('base64')
}

/**
 * Manda una transacción y espera a verla confirmada consultando su estado
 * (vale igual para las de blockhash normal y las de nonce duradero). Si ya
 * se había mandado antes, no pasa nada: la red la trata como la misma.
 */
export async function sendAndConfirm(tx: VersionedTransaction, timeoutMs = 60_000): Promise<string> {
  const conn = solanaConnection()
  const raw = tx.serialize()
  const signature = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 })
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const { value } = await conn.getSignatureStatuses([signature])
    const st = value[0]
    if (st?.err) throw new Error('La transacción falló en la red')
    if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return signature
    await new Promise((r) => setTimeout(r, 1500))
    // Reenvío mientras no entra: en momentos de congestión se pierden paquetes
    await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {})
  }
  throw new Error('La transacción no se confirmó a tiempo')
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
  const txs = signedB64.slice(0, 3).map((b) => VersionedTransaction.deserialize(Buffer.from(b, 'base64')))
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
export async function coinExistsOnChain(mint: string, platform?: string): Promise<boolean> {
  if (platform === 'bonk') return bonkCoinExists(mint)
  if (platform === 'cabal') return cabalCoinExists(mint)
  const info = await solanaConnection().getAccountInfo(bondingCurvePda(mint), 'confirmed')
  return Boolean(info)
}
