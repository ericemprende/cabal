import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { fetchCallResult } from '@/lib/chain-stats'
import { cached } from '@/lib/cache'

// GET /api/admin/calls — cada call por usuario, con su %s en vivo desde que
// se publicó. Las calls en sí son públicas (cualquiera las ve en el feed);
// esto es solo la vista agregada de winrate por usuario para el admin.
export async function GET(req: Request) {
  try {
    await requireAdmin(req)

    // Últimas 300: suficiente para el dashboard sin martillar DexScreener/
    // GeckoTerminal con cientos de contratos en cada carga.
    const calls = await db.post.findMany({
      where: { kind: 'call', contract: { not: null }, network: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { user: { select: { id: true, name: true, handle: true, avatar: true } } },
    })

    // En tandas de 10: 300 llamadas simultáneas a DexScreener/GeckoTerminal
    // solo consiguen que la mayoría de responda 429/timeout.
    const results: {
      id: string
      content: string
      contract: string | null
      network: string | null
      createdAt: string
      user: (typeof calls)[number]['user']
      symbol: string
      pctChange: number | null
      found: boolean
    }[] = []
    const CONCURRENCY = 10
    for (let i = 0; i < calls.length; i += CONCURRENCY) {
      const chunk = calls.slice(i, i + CONCURRENCY)
      const chunkResults = await Promise.all(
        chunk.map(async (c) => {
          const r = await cached(`call-result:${c.id}`, 60, () =>
            // Solo el % actual: sin velas, que agotarían el límite de GeckoTerminal
            fetchCallResult(c.network!, c.contract!, c.createdAt, { priceUsd: c.entryPriceUsd, mc: c.entryMc }, { candles: false })
          )
          return {
            id: c.id,
            content: c.content,
            contract: c.contract,
            network: c.network,
            createdAt: c.createdAt.toISOString(),
            user: c.user,
            symbol: r.symbol,
            pctChange: r.pctChange,
            found: r.found,
          }
        })
      )
      results.push(...chunkResults)
    }

    // Agregado por usuario: total de calls, cuántas tienen dato, winrate y %s promedio
    const byUser = new Map<
      string,
      { user: (typeof results)[number]['user']; total: number; withData: number; wins: number; sumPct: number }
    >()
    for (const r of results) {
      const key = r.user.id
      const entry = byUser.get(key) ?? { user: r.user, total: 0, withData: 0, wins: 0, sumPct: 0 }
      entry.total += 1
      if (r.pctChange !== null) {
        entry.withData += 1
        entry.sumPct += r.pctChange
        if (r.pctChange > 0) entry.wins += 1
      }
      byUser.set(key, entry)
    }
    const leaderboard = [...byUser.values()]
      .map((e) => ({
        user: e.user,
        total: e.total,
        withData: e.withData,
        winRate: e.withData > 0 ? Math.round((e.wins / e.withData) * 1000) / 10 : null,
        avgPct: e.withData > 0 ? Math.round((e.sumPct / e.withData) * 10) / 10 : null,
      }))
      .sort((a, b) => (b.avgPct ?? -Infinity) - (a.avgPct ?? -Infinity))

    return NextResponse.json({ calls: results, leaderboard })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
