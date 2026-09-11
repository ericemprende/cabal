import { NextResponse } from 'next/server'
import { SOL_MINT, swapFeeConfig } from '@/lib/swap'
import type { SwapConfigDTO } from '@/lib/types'

/**
 * GET /api/swap/config — nada secreto: la cuenta de referido y la comisión ya
 * son públicas en cuanto se usan en una transacción on-chain.
 */
export async function GET() {
  const dto: SwapConfigDTO = { enabled: true, solMint: SOL_MINT, fee: swapFeeConfig() }
  return NextResponse.json(dto)
}
