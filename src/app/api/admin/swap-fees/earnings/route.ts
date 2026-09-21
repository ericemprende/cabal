import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import type { SwapFeeEarningsDTO, SwapFeeTotalsDTO } from '@/lib/types'

const DAY = 24 * 60 * 60 * 1000

type Agg = { _sum: { feeUsd: number | null; amountUsd: number | null }; _count: { _all: number } }
const totals = (a: Agg): SwapFeeTotalsDTO => ({
  feeUsd: a._sum.feeUsd ?? 0,
  volumeUsd: a._sum.amountUsd ?? 0,
  trades: a._count._all,
})

/**
 * Lo que Cabal lleva ganado por las comisiones de compra/venta. Se calcula
 * sobre SwapIntent, que es la fila que se crea en cada swap con comisión:
 *
 * - `consumed: true` = la transacción se confirmó on-chain (lo comprueba
 *   /api/swap/confirm antes de marcarla), así que es plata cobrada de verdad.
 * - `consumed: false` = se firmó la intención pero nunca llegó la
 *   confirmación: o la persona canceló en su wallet, o cerró la pestaña
 *   justo después de firmar. Va aparte, como "sin confirmar", porque parte
 *   de eso sí se cobró y parte no.
 *
 * El importe es el estimado (monto × comisión), no lo que de verdad cayó en
 * la cuenta de referido de Jupiter / la feeWallet de EVM: ignora impacto de
 * precio y slippage. Sirve para seguir el negocio, no como contabilidad.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const now = Date.now()
    const since = (days: number) => new Date(now - days * DAY)
    const sum = (where: object) =>
      db.swapIntent.aggregate({ where, _sum: { feeUsd: true, amountUsd: true }, _count: { _all: true } })

    const done = { consumed: true }
    const [all, d30, d7, d1, pending, byNetwork, byKind, recent, series] = await Promise.all([
      sum(done),
      sum({ ...done, createdAt: { gte: since(30) } }),
      sum({ ...done, createdAt: { gte: since(7) } }),
      sum({ ...done, createdAt: { gte: since(1) } }),
      sum({ consumed: false }),
      db.swapIntent.groupBy({
        by: ['network'],
        where: done,
        _sum: { feeUsd: true, amountUsd: true },
        _count: { _all: true },
      }),
      db.swapIntent.groupBy({
        by: ['kind'],
        where: done,
        _sum: { feeUsd: true, amountUsd: true },
        _count: { _all: true },
      }),
      db.swapIntent.findMany({ where: done, orderBy: { createdAt: 'desc' }, take: 15 }),
      db.swapIntent.findMany({
        where: { ...done, createdAt: { gte: since(29) } },
        select: { createdAt: true, feeUsd: true },
      }),
    ])

    // Serie diaria de los últimos 30 días, con los días vacíos en 0 para que
    // el gráfico no invente una línea recta entre dos días con actividad.
    const buckets = new Map<string, number>()
    for (let i = 29; i >= 0; i--) buckets.set(new Date(now - i * DAY).toISOString().slice(0, 10), 0)
    for (const row of series) {
      const key = row.createdAt.toISOString().slice(0, 10)
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + row.feeUsd)
    }

    const dto: SwapFeeEarningsDTO = {
      all: totals(all),
      last30d: totals(d30),
      last7d: totals(d7),
      last24h: totals(d1),
      pending: totals(pending),
      byNetwork: byNetwork
        .map((r) => ({ network: r.network, ...totals(r) }))
        .sort((a, b) => b.feeUsd - a.feeUsd),
      byKind: byKind.map((r) => ({ kind: r.kind, ...totals(r) })),
      series: [...buckets].map(([date, feeUsd]) => ({ date, feeUsd })),
      recent: recent.map((r) => ({
        id: r.id,
        network: r.network,
        kind: r.kind,
        walletAddress: r.walletAddress,
        mint: r.mint,
        amountUsd: r.amountUsd,
        feeUsd: r.feeUsd,
        createdAt: r.createdAt.toISOString(),
      })),
    }
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
