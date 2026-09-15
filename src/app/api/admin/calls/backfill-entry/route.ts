import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { fetchCallResult } from '@/lib/chain-stats'

// POST /api/admin/calls/backfill-entry — rellena entryPriceUsd/entryMc en
// calls publicadas ANTES de que esa columna existiera. No hay forma de saber
// el precio exacto al segundo de calledAt a esta altura, así que se usa el
// mismo método de reconstrucción por velas que ya usaba `fetchCallResult`
// como fallback (vela de minuto de GeckoTerminal más cercana a calledAt); una
// vez guardado, esa call deja de depender de reconstruirlo en cada carga.
export async function POST(req: Request) {
  try {
    await requireAdmin(req)

    const pending = await db.post.findMany({
      where: { kind: 'call', contract: { not: null }, network: { not: null }, entryPriceUsd: null },
      orderBy: { createdAt: 'asc' },
    })

    let updated = 0
    let skipped = 0
    const CONCURRENCY = 8
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const chunk = pending.slice(i, i + CONCURRENCY)
      await Promise.all(
        chunk.map(async (post) => {
          try {
            const result = await fetchCallResult(post.network!, post.contract!, post.createdAt)
            if (result.entryPriceUsd !== null) {
              await db.post.update({
                where: { id: post.id },
                data: { entryPriceUsd: result.entryPriceUsd, entryMc: result.entryMc },
              })
              updated++
            } else {
              skipped++
            }
          } catch {
            skipped++
          }
        })
      )
    }

    return NextResponse.json({ ok: true, total: pending.length, updated, skipped })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
