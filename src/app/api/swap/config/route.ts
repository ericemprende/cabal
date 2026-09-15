import { NextResponse } from 'next/server'
import { SOL_MINT, swapFeeConfig } from '@/lib/swap'
import { isEvmNetwork } from '@/lib/swap-evm'
import type { SwapConfigDTO } from '@/lib/types'

/**
 * GET /api/swap/config — nada secreto: la cuenta de referido y la comisión ya
 * son públicas en cuanto se usan en una transacción on-chain.
 *
 * Sin `?network=`, responde igual que siempre (Solana) para no romper a
 * useSwapConfig(). Con `?network=ethereum|base|bsc`, responde la comisión de
 * esa red EVM en el mismo formato (sin solMint, porque no aplica).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const network = searchParams.get('network')?.trim() || 'solana'
  const fee = await swapFeeConfig(network)
  const dto: SwapConfigDTO = {
    enabled: network === 'solana' || isEvmNetwork(network),
    solMint: network === 'solana' ? SOL_MINT : '',
    fee: fee
      ? {
          referralAccount: fee.referralAccount,
          feeBps: fee.feeBps,
          smallTradeUsd: fee.smallTradeUsd,
          smallTradeFeeBps: fee.smallTradeFeeBps,
          note: fee.note,
        }
      : null,
  }
  return NextResponse.json(dto)
}
