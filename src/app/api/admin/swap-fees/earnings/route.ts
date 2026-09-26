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
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Periodo consultado (?from=yyyy-mm-dd&to=yyyy-mm-dd, ambos incluidos, en
 * UTC). Sin fechas válidas: los últimos 30 días. Como mucho un año.
 */
function parseRange(url: URL, now: number): { from: Date; to: Date } {
  const f = url.searchParams.get('from') ?? ''
  const t = url.searchParams.get('to') ?? ''
  let from = ISO_DAY.test(f) ? new Date(`${f}T00:00:00.000Z`) : new Date(now - 29 * DAY)
  let to = ISO_DAY.test(t) ? new Date(`${t}T00:00:00.000Z`) : new Date(now)
  if (Number.isNaN(from.getTime())) from = new Date(now - 29 * DAY)
  if (Number.isNaN(to.getTime())) to = new Date(now)
  from = new Date(from.toISOString().slice(0, 10) + 'T00:00:00.000Z')
  to = new Date(to.toISOString().slice(0, 10) + 'T00:00:00.000Z')
  if (to < from) [from, to] = [to, from]
  if (to.getTime() - from.getTime() > 366 * DAY) from = new Date(to.getTime() - 366 * DAY)
  return { from, to }
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const now = Date.now()
    const since = (days: number) => new Date(now - days * DAY)
    const sum = (where: object) =>
      db.swapIntent.aggregate({ where, _sum: { feeUsd: true, amountUsd: true }, _count: { _all: true } })

    const { from, to } = parseRange(new URL(req.url), now)
    const inRange = { createdAt: { gte: from, lt: new Date(to.getTime() + DAY) } }
    const done = { consumed: true }
    const doneInRange = { ...done, ...inRange }
    const [all, d30, d7, d1, range, pending, byNetwork, byKind, recent, series] = await Promise.all([
      sum(done),
      sum({ ...done, createdAt: { gte: since(30) } }),
      sum({ ...done, createdAt: { gte: since(7) } }),
      sum({ ...done, createdAt: { gte: since(1) } }),
      sum(doneInRange),
      sum({ consumed: false, ...inRange }),
      db.swapIntent.groupBy({
        by: ['network'],
        where: doneInRange,
        _sum: { feeUsd: true, amountUsd: true },
        _count: { _all: true },
      }),
      db.swapIntent.groupBy({
        by: ['kind'],
        where: doneInRange,
        _sum: { feeUsd: true, amountUsd: true },
        _count: { _all: true },
      }),
      db.swapIntent.findMany({ where: doneInRange, orderBy: { createdAt: 'desc' }, take: 50 }),
      db.swapIntent.findMany({
        where: doneInRange,
        select: { createdAt: true, feeUsd: true },
      }),
    ])

    // Serie diaria del periodo, con los días vacíos en 0 para que el gráfico
    // no invente una línea recta entre dos días con actividad.
    const buckets = new Map<string, number>()
    for (let d = from.getTime(); d <= to.getTime(); d += DAY) buckets.set(new Date(d).toISOString().slice(0, 10), 0)
    for (const row of series) {
      const key = row.createdAt.toISOString().slice(0, 10)
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + row.feeUsd)
    }

    const dto: SwapFeeEarningsDTO = {
      all: totals(all),
      last30d: totals(d30),
      last7d: totals(d7),
      last24h: totals(d1),
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), ...totals(range) },
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
