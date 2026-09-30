import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { DONATION_PLAN } from '@/lib/donate-server'
import { solPriceUsd } from '@/lib/swap'
import type { RevenueDTO, RevenueSource } from '@/lib/types'

const DAY = 24 * 60 * 60 * 1000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
/** Estados de Payment que son plata cobrada: Stripe `paid`, NOWPayments `finished`. */
const PAID = ['paid', 'finished']

/**
 * GET /api/admin/revenue?from=yyyy-mm-dd&to=yyyy-mm-dd — todo lo que ingresa
 * Cabal, junto y en dólares:
 *
 * - premium: cobros del plan (Payment que no es donación ni munición).
 * - ammo: cargadores de munición (Payment con plan `ammo_*`).
 * - donations: donaciones (Payment con plan `donation`).
 * - launch: comisión fija por crear token (PumpCoin.feeSol, en SOL, pasada a
 *   dólares al precio de SOL de AHORA: es una estimación).
 * - swap: comisión de compra/venta confirmada on-chain (SwapIntent.feeUsd,
 *   también estimada; el detalle está en /api/admin/swap-fees/earnings).
 *
 * La parte de Cabal en el trading de Cabal Launch (Meteora) no está aquí: se
 * reclama on-chain desde /admin → Comisiones y Cabal no la registra.
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

type Row = { source: RevenueSource; at: Date; usd: number; label: string; who: string | null }

function paymentSource(plan: string): RevenueSource {
  if (plan === DONATION_PLAN) return 'donations'
  if (plan.startsWith('ammo_')) return 'ammo'
  return 'premium'
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const now = Date.now()
    const { from, to } = parseRange(new URL(req.url), now)
    const end = new Date(to.getTime() + DAY)

    // Todo el histórico: son pocas filas (una por cobro), y así los totales
    // "desde siempre" y los del periodo salen de la misma lectura.
    const [payments, coins, swapAll, swapRows, solUsd] = await Promise.all([
      db.payment.findMany({
        where: { status: { in: PAID } },
        select: { plan: true, amountUsd: true, createdAt: true, provider: true, user: { select: { handle: true } } },
      }),
      db.pumpCoin.findMany({
        where: { feeSol: { gt: 0 }, OR: [{ launchedAt: { not: null } }, { feeSignature: { not: null } }] },
        select: { feeSol: true, symbol: true, platform: true, launchedAt: true, createdAt: true, user: { select: { handle: true } } },
      }),
      db.swapIntent.aggregate({ where: { consumed: true }, _sum: { feeUsd: true } }),
      db.swapIntent.findMany({
        where: { consumed: true, createdAt: { gte: new Date(Math.min(from.getTime(), now - 30 * DAY)), lt: end } },
        select: { feeUsd: true, createdAt: true, network: true, kind: true },
      }),
      solPriceUsd().catch(() => 0),
    ])

    const rows: Row[] = [
      ...payments.map((p) => ({
        source: paymentSource(p.plan),
        at: p.createdAt,
        usd: p.amountUsd,
        label: `${p.plan} · ${p.provider === 'stripe' ? 'tarjeta' : 'cripto'}`,
        who: p.user.handle,
      })),
      ...coins.map((c) => ({
        source: 'launch' as const,
        at: c.launchedAt ?? c.createdAt,
        usd: c.feeSol * solUsd,
        label: `$${c.symbol} en ${c.platform} · ${c.feeSol} SOL`,
        who: c.user.handle,
      })),
    ]
    const swapRowsMapped: Row[] = swapRows.map((s) => ({
      source: 'swap',
      at: s.createdAt,
      usd: s.feeUsd,
      label: `${s.kind === 'buy' ? 'Compra' : 'Venta'} en ${s.network}`,
      who: null,
    }))

    const sources: RevenueSource[] = ['premium', 'ammo', 'donations', 'launch', 'swap']
    const zero = () => Object.fromEntries(sources.map((s) => [s, 0])) as Record<RevenueSource, number>
    const sumSince = (list: Row[], since: number, until = Infinity) => {
      const out = zero()
      for (const r of list) {
        const t = r.at.getTime()
        if (t >= since && t < until) out[r.source] += r.usd
      }
      return out
    }

    const all = sumSince(rows, 0)
    all.swap = swapAll._sum.feeUsd ?? 0
    const every = [...rows, ...swapRowsMapped]
    const range = sumSince(every, from.getTime(), end.getTime())

    // Serie diaria del periodo, por fuente, con los días vacíos en 0
    const buckets = new Map<string, Record<RevenueSource, number>>()
    for (let d = from.getTime(); d <= to.getTime(); d += DAY) buckets.set(new Date(d).toISOString().slice(0, 10), zero())
    for (const r of every) {
      const b = buckets.get(r.at.toISOString().slice(0, 10))
      if (b) b[r.source] += r.usd
    }

    const round = (o: Record<RevenueSource, number>) =>
      Object.fromEntries(sources.map((s) => [s, Math.round(o[s] * 100) / 100])) as Record<RevenueSource, number>

    const dto: RevenueDTO = {
      solUsd,
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), bySource: round(range) },
      all: round(all),
      last30d: round(sumSince(every, now - 30 * DAY)),
      last7d: round(sumSince(every, now - 7 * DAY)),
      series: [...buckets].map(([date, v]) => ({ date, ...round(v) })),
      // Los cobros sueltos del periodo; los swaps no, que son muchos y tienen su propio detalle
      recent: rows
        .filter((r) => r.at >= from && r.at < end)
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, 60)
        .map((r) => ({ source: r.source, at: r.at.toISOString(), usd: Math.round(r.usd * 100) / 100, label: r.label, who: r.who })),
    }
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
