import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { NETWORKS } from '@/lib/cabal'
import { allTreasuries } from '@/lib/swap-treasury'
import type { SwapTreasuryDTO } from '@/lib/types'

/**
 * El saldo real, sin reclamar, de las cuentas donde cae la comisión — leído
 * de la cadena, no de nuestra base. Va aparte de /earnings a propósito: eso
 * es el histórico de lo cobrado, esto es lo que queda por retirar ahora.
 *
 * Es lento (RPC de varias redes + cotizaciones), así que el cliente lo pide
 * bajo demanda y no en cada render.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const networks = await allTreasuries(Object.keys(NETWORKS))
    const dto: SwapTreasuryDTO = {
      networks,
      usdTotal: networks.reduce((acc, n) => acc + n.usdTotal, 0),
      unpriced: networks.reduce((acc, n) => acc + n.unpriced, 0),
      checkedAt: new Date().toISOString(),
    }
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
