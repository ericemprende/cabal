import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { NETWORKS } from '@/lib/cabal'
import { swapFeeConfig } from '@/lib/swap'
import type { SwapFeeConfigDTO } from '@/lib/types'

function toDTO(row: {
  network: string
  enabled: boolean
  feeBps: number
  smallTradeUsd: number
  smallTradeFeeBps: number
  referralAccount: string
  feeWallet: string
  note: string
}): SwapFeeConfigDTO {
  return {
    network: row.network,
    enabled: row.enabled,
    feeBps: row.feeBps,
    smallTradeUsd: row.smallTradeUsd,
    smallTradeFeeBps: row.smallTradeFeeBps,
    referralAccount: row.referralAccount,
    feeWallet: row.feeWallet,
    note: row.note,
  }
}

/** Una fila por cada red soportada, aunque todavía no tenga swap propio (queda en 0/disabled). */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const rows = await db.swapFeeConfig.findMany()
    const byNetwork = new Map(rows.map((r) => [r.network, r]))
    const all = await Promise.all(
      Object.keys(NETWORKS).map(async (network) => {
        const row = byNetwork.get(network)
        if (row) return toDTO(row)
        // Sin fila todavía: si es Solana, muestra lo que ya viene de las
        // variables de entorno (de antes de que esto fuera editable), para
        // que el admin no vea todo en blanco aunque ya esté cobrando.
        const fromEnv = await swapFeeConfig(network)
        return {
          network,
          enabled: !!fromEnv,
          feeBps: fromEnv?.feeBps ?? 37,
          smallTradeUsd: fromEnv?.smallTradeUsd ?? 10,
          smallTradeFeeBps: fromEnv?.smallTradeFeeBps ?? 5,
          referralAccount: fromEnv?.referralAccount ?? '',
          feeWallet: fromEnv?.feeWallet ?? '',
          note: fromEnv?.note ?? '',
        }
      })
    )
    return NextResponse.json(all)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const network = String(body.network ?? '').trim()
    if (!(network in NETWORKS)) return NextResponse.json({ error: 'Red no válida' }, { status: 400 })

    const feeBps = Math.round(Number(body.feeBps))
    const smallTradeUsd = Number(body.smallTradeUsd)
    const smallTradeFeeBps = Math.round(Number(body.smallTradeFeeBps))
    if (!(feeBps >= 0 && feeBps <= 1000)) return NextResponse.json({ error: 'Comisión no válida (0-1000 bps)' }, { status: 400 })
    if (!(smallTradeUsd >= 0 && smallTradeUsd <= 10_000)) return NextResponse.json({ error: 'Umbral no válido' }, { status: 400 })
    if (!(smallTradeFeeBps >= 0 && smallTradeFeeBps <= 1000)) return NextResponse.json({ error: 'Comisión mínima no válida' }, { status: 400 })

    const data = {
      enabled: !!body.enabled,
      feeBps,
      smallTradeUsd,
      smallTradeFeeBps,
      referralAccount: String(body.referralAccount ?? '').trim(),
      feeWallet: String(body.feeWallet ?? '').trim(),
      note: String(body.note ?? '').slice(0, 500),
    }
    const row = await db.swapFeeConfig.upsert({
      where: { network },
      update: data,
      create: { network, ...data },
    })
    return NextResponse.json({ ok: true, config: toDTO(row) })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
