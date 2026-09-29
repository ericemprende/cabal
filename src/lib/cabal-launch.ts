import BN from 'bn.js'
import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type Transaction,
  type TransactionInstruction,
} from '@solana/web3.js'
import { NATIVE_MINT } from '@solana/spl-token'
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  DynamicBondingCurveClient,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithMarketCap,
  deriveDbcPoolAddress,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { db } from '@/lib/db'
import { solanaConnection } from '@/lib/swap'

/**
 * Cabal Launch: el launchpad propio de Cabal, sobre la Dynamic Bonding Curve
 * de Meteora (SDK oficial). Cabal es el "partner" de una configuración única
 * que comparten todos sus tokens y que fija para siempre:
 *
 * - 1 % por operación en la curva. Meteora se queda el 20 % de eso; del resto,
 *   el 70 % es del dev (creatorTradingFeePercentage) y el 30 % de Cabal.
 * - Curva estilo pump.fun: arranca en ~30 SOL de capitalización y gradúa a un
 *   pool DAMM v2 de Meteora al llegar a ~400 SOL (~86 SOL recaudados,
 *   comprobado con buildCurveWithMarketCap).
 * - Al graduarse, la liquidez queda bloqueada para siempre 70 % dev / 30 %
 *   Cabal, así que las comisiones del pool también se reparten 70/30.
 *
 * Las comisiones se acumulan en cada pool: el dev reclama las suyas desde
 * "Tus lanzamientos" y Cabal las suyas desde /admin (firmando con su wallet).
 * La configuración se crea una vez desde /admin y su dirección queda en
 * Setting (CABAL_CONFIG_KEY). Cambiar algo de aquí exige crear otra.
 */

export const CABAL_CONFIG_KEY = 'cabal_launch_config'

export const CABAL_LAUNCH_TERMS = {
  tradingFeeBps: 100,
  creatorTradingFeePercentage: 70,
  initialMarketCapSol: 30,
  migrationMarketCapSol: 400,
  creatorLockedLiquidityPercentage: 70,
  partnerLockedLiquidityPercentage: 30,
}

export function cabalCurveParams() {
  return buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.NINE,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000_000,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: CABAL_LAUNCH_TERMS.tradingFeeBps,
          endingFeeBps: CABAL_LAUNCH_TERMS.tradingFeeBps,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: CABAL_LAUNCH_TERMS.creatorTradingFeePercentage,
      // La tarifa por lanzamiento la cobra Cabal aparte (lib/pump-launch.ts):
      // así llega entera, sin el 10 % que Meteora se queda de esta
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage: CABAL_LAUNCH_TERMS.partnerLockedLiquidityPercentage,
      creatorLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: CABAL_LAUNCH_TERMS.creatorLockedLiquidityPercentage,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: CABAL_LAUNCH_TERMS.initialMarketCapSol,
    migrationMarketCap: CABAL_LAUNCH_TERMS.migrationMarketCapSol,
  })
}

let _client: DynamicBondingCurveClient | null = null
function dbc(): DynamicBondingCurveClient {
  if (!_client) _client = DynamicBondingCurveClient.create(solanaConnection(), 'confirmed')
  return _client
}

function stripBudget(ixs: TransactionInstruction[]): TransactionInstruction[] {
  return ixs.filter((ix) => !ix.programId.equals(ComputeBudgetProgram.programId))
}

async function toV0(tx: Transaction, payer: PublicKey): Promise<string> {
  const { blockhash } = await solanaConnection().getLatestBlockhash('confirmed')
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }), ...stripBudget(tx.instructions)],
  }).compileToV0Message()
  return Buffer.from(new VersionedTransaction(message).serialize()).toString('base64')
}

/** Dirección de la configuración de Cabal Launch, o null si aún no se creó. */
export async function cabalConfigId(): Promise<PublicKey | null> {
  const row = await db.setting.findUnique({ where: { key: CABAL_CONFIG_KEY } }).catch(() => null)
  if (!row?.value) return null
  try {
    return new PublicKey(row.value)
  } catch {
    return null
  }
}

/**
 * Transacción que crea la configuración (una sola vez). La firman la wallet
 * que paga (admin) y la clave de la configuración, generada en el navegador.
 * `feeClaimer` es la wallet que cobra la parte de Cabal.
 */
export async function buildCabalConfigTx(p: { payer: string; config: string; feeClaimer: string }): Promise<string> {
  const payer = new PublicKey(p.payer)
  const feeClaimer = new PublicKey(p.feeClaimer)
  const tx = await dbc().partner.createConfig({
    config: new PublicKey(p.config),
    feeClaimer,
    leftoverReceiver: feeClaimer,
    payer,
    quoteMint: NATIVE_MINT,
    ...cabalCurveParams(),
  })
  return toV0(tx, payer)
}

/** Instrucciones del lanzamiento en Cabal Launch, agrupadas por transacción. */
export async function cabalInstructionGroups(p: {
  mint: string
  creator: string
  name: string
  symbol: string
  uri: string
  initialBuySol: number
}): Promise<TransactionInstruction[][]> {
  const config = await cabalConfigId()
  if (!config) throw new Error('Cabal Launch todavía no está configurado')
  const creator = new PublicKey(p.creator)
  const buy = p.initialBuySol > 0
  const tx = await dbc().creator.createPoolWithFirstBuy({
    createPoolParam: {
      name: p.name,
      symbol: p.symbol,
      uri: p.uri,
      payer: creator,
      poolCreator: creator,
      config,
      baseMint: new PublicKey(p.mint),
    },
    firstBuyParam: buy
      ? {
          buyer: creator,
          buyAmount: new BN(Math.round(p.initialBuySol * LAMPORTS_PER_SOL)),
          minimumAmountOut: new BN(1),
          referralTokenAccount: null,
        }
      : undefined,
  })
  const ixs = stripBudget(tx.instructions)
  if (!buy) return [ixs]
  // Crear + comprar se parten tras la creación del pool, como en Pump y Bonk,
  // para no pasar de 1232 bytes
  const cut = ixs.findIndex((ix) => ix.programId.equals(DYNAMIC_BONDING_CURVE_PROGRAM_ID)) + 1
  return [ixs.slice(0, cut), ixs.slice(cut)].filter((g) => g.length > 0)
}

export async function cabalPoolAddress(mint: string): Promise<PublicKey | null> {
  const config = await cabalConfigId()
  return config ? deriveDbcPoolAddress(NATIVE_MINT, new PublicKey(mint), config) : null
}

/** true si el token ya existe en Cabal Launch (su pool está en la red). */
export async function cabalCoinExists(mint: string): Promise<boolean> {
  const pool = await cabalPoolAddress(mint)
  return Boolean(pool && (await solanaConnection().getAccountInfo(pool, 'confirmed')))
}

/** Comisiones pendientes de reclamar de un pool, en SOL (parte del dev y de Cabal). */
export async function cabalPendingFees(mint: string): Promise<{ creatorSol: number; partnerSol: number } | null> {
  const pool = await cabalPoolAddress(mint)
  if (!pool) return null
  const m = await dbc().state.getPoolFeeMetrics(pool).catch(() => null)
  if (!m) return null
  return {
    creatorSol: m.current.creatorQuoteFee.toNumber() / LAMPORTS_PER_SOL,
    partnerSol: m.current.partnerQuoteFee.toNumber() / LAMPORTS_PER_SOL,
  }
}

const ALL = new BN('18446744073709551615') // u64 máx.: reclamar todo lo que haya

/** Transacción para que el dev reclame sus comisiones de un token. La firma el dev. */
export async function buildCreatorClaimTx(creator: string, mint: string): Promise<string> {
  const pool = await cabalPoolAddress(mint)
  if (!pool) throw new Error('Cabal Launch todavía no está configurado')
  const owner = new PublicKey(creator)
  const tx = await dbc().creator.claimCreatorTradingFee({
    creator: owner,
    payer: owner,
    pool,
    maxBaseAmount: ALL,
    maxQuoteAmount: ALL,
  })
  return toV0(tx, owner)
}

/** Transacción para que Cabal reclame su parte de un token. La firma la wallet de Cabal. */
export async function buildPartnerClaimTx(feeClaimer: string, mint: string): Promise<string> {
  const pool = await cabalPoolAddress(mint)
  if (!pool) throw new Error('Cabal Launch todavía no está configurado')
  const owner = new PublicKey(feeClaimer)
  const tx = await dbc().partner.claimPartnerTradingFee({
    feeClaimer: owner,
    payer: owner,
    pool,
    maxBaseAmount: ALL,
    maxQuoteAmount: ALL,
  })
  return toV0(tx, owner)
}
