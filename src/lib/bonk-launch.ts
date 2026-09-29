import BN from 'bn.js'
import { ComputeBudgetProgram, LAMPORTS_PER_SOL, PublicKey, type TransactionInstruction } from '@solana/web3.js'
import { NATIVE_MINT } from '@solana/spl-token'
import {
  LAUNCHPAD_PROGRAM,
  LaunchpadConfig,
  Raydium,
  TxVersion,
  getPdaLaunchpadConfigId,
  getPdaLaunchpadPoolId,
} from '@raydium-io/raydium-sdk-v2'
import { solanaConnection } from '@/lib/swap'

/**
 * Bonk (letsbonk.fun) sobre Raydium LaunchLab, con el SDK oficial de Raydium.
 *
 * LaunchLab es una curva de bonding como la de pump.fun; cada token pertenece
 * a una "plataforma" y la de letsbonk.fun es BONK_PLATFORM_ID (comprobado en
 * la red: se llama letsbonk.fun y es la que usa hoy su web). La curva es la
 * estándar en SOL (config PDA con curveType 0, índice 0).
 *
 * El SDK arma transacciones enteras; aquí se sacan sus instrucciones (sin las
 * de compute budget, que pone lib/pump-launch.ts) para que la comisión de
 * Cabal, los nonces de los programados y las firmas vayan igual que en Pump.
 */

export const BONK_PLATFORM_ID = new PublicKey('FfYek5vEz23cMkWsdJwG2oa6EphsvXSHrGpdALN4g6W1')
const BONK_DECIMALS = 6

function stripBudget(ixs: TransactionInstruction[]): TransactionInstruction[] {
  return ixs.filter((ix) => !ix.programId.equals(ComputeBudgetProgram.programId))
}

export async function bonkInstructionGroups(p: {
  mint: string
  creator: string
  name: string
  symbol: string
  uri: string
  initialBuySol: number
}): Promise<TransactionInstruction[][]> {
  const connection = solanaConnection()
  const creator = new PublicKey(p.creator)
  const raydium = await Raydium.load({ connection, owner: creator, disableLoadToken: true, disableFeatureCheck: true })

  const configId = getPdaLaunchpadConfigId(LAUNCHPAD_PROGRAM, NATIVE_MINT, 0, 0).publicKey
  const configData = await connection.getAccountInfo(configId)
  if (!configData) throw new Error('No se encontró la curva de LaunchLab')
  const configInfo = LaunchpadConfig.decode(configData.data)

  const buy = p.initialBuySol > 0
  const { transactions } = await raydium.launchpad.createLaunchpad({
    programId: LAUNCHPAD_PROGRAM,
    platformId: BONK_PLATFORM_ID,
    mintA: new PublicKey(p.mint),
    decimals: BONK_DECIMALS,
    name: p.name,
    symbol: p.symbol,
    uri: p.uri,
    // La plataforma de letsbonk.fun exige graduar a CPMM (con 'amm' el
    // programa responde MigrateTypeNotMatch, comprobado simulando en mainnet)
    migrateType: 'cpmm',
    configId,
    configInfo,
    mintBDecimals: 9,
    txVersion: TxVersion.LEGACY,
    slippage: new BN(100), // 1 %
    buyAmount: new BN(buy ? Math.round(p.initialBuySol * LAMPORTS_PER_SOL) : 0),
    createOnly: !buy,
    feePayer: creator,
  })
  const ixs = transactions.flatMap((tx) => stripBudget(tx.instructions))
  if (!buy) return [ixs]
  // Crear + comprar juntos pasan de 1232 bytes: se parte tras la instrucción
  // de creación de LaunchLab, igual que en Pump
  const cut = ixs.findIndex((ix) => ix.programId.equals(LAUNCHPAD_PROGRAM)) + 1
  return [ixs.slice(0, cut), ixs.slice(cut)].filter((g) => g.length > 0)
}

/** true si el token ya existe en LaunchLab (su pool está en la red). */
export async function bonkCoinExists(mint: string): Promise<boolean> {
  const pool = getPdaLaunchpadPoolId(LAUNCHPAD_PROGRAM, new PublicKey(mint), NATIVE_MINT).publicKey
  return Boolean(await solanaConnection().getAccountInfo(pool, 'confirmed'))
}
