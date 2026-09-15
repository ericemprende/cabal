import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchCallResult } from '@/lib/chain-stats'
import { cached } from '@/lib/cache'

// GET /api/posts/[id]/result — resultado en vivo de una call (público: las
// calls son públicas por diseño, cualquiera puede ver cómo le fue).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const post = await db.post.findUnique({ where: { id } })
    if (!post || post.kind !== 'call' || !post.contract || !post.network) {
      return NextResponse.json({ error: 'Esta call no tiene contrato/red' }, { status: 404 })
    }

    // 20s de caché: el precio no necesita ser exacto al segundo y evita
    // martillar DexScreener/GeckoTerminal en cada refresco del feed.
    const result = await cached(`call-result:${id}`, 20, () =>
      fetchCallResult(post.network!, post.contract!, post.createdAt, {
        priceUsd: post.entryPriceUsd,
        mc: post.entryMc,
      })
    )

    return NextResponse.json({ ...result, calledAt: post.createdAt.toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
