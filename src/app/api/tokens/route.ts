import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toPublicUserDTO } from '@/lib/serializers'
import { ensureTokensFresh } from '@/lib/tokens-sync'
import { cached } from '@/lib/cache'
import type { TokenDTO } from '@/lib/types'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') ?? 'trending'
    const network = searchParams.get('network') ?? 'all'

    // Convierte en token los launches que ya salieron y refresca el mercado
    await ensureTokensFresh()

    // La lista es igual para todo el mundo: se calcula una vez por minuto en
    // vez de leer todos los tokens (con sus joins) y contar todos los posts en
    // cada visita.
    const dto = await cached(`tokens:${sort}:${network}`, 60, () => buildTokenList(sort, network))

    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

async function buildTokenList(sort: string, network: string): Promise<TokenDTO[]> {
  const tokens = await db.token.findMany({
    include: { dev: true, launch: { include: { createdBy: true } } },
    orderBy: { mc: 'desc' },
  })
  const postsCounts = await db.post.groupBy({ by: ['tokenId'], _count: { _all: true } })
  const countMap = new Map(postsCounts.filter((p) => p.tokenId).map((p) => [p.tokenId!, p._count._all]))

  let list = tokens.filter((t) => network === 'all' || t.network === network)
  if (sort === 'new') list = [...list].sort((a, b) => b.launchedAt.getTime() - a.launchedAt.getTime())
  else if (sort === 'winners') list = [...list].sort((a, b) => b.change24h - a.change24h)
  else if (sort === 'losers') list = [...list].sort((a, b) => a.change24h - b.change24h)
  else if (sort === 'trending') list = [...list].sort((a, b) => b.volume24h - a.volume24h)
  else if (sort === 'risk') list = [...list].sort((a, b) => b.top10Pct - a.top10Pct)

  return list.map((t) => ({
    id: t.id,
    name: t.name,
    ticker: t.ticker,
    emoji: t.emoji,
    image: t.image,
    network: t.network,
    price: t.price,
    mc: t.mc,
    change24h: t.change24h,
    volume24h: t.volume24h,
    holders: t.holders,
    top10Pct: t.top10Pct,
    contract: t.contract,
    launchedAt: t.launchedAt.toISOString(),
    athMc: t.athMc,
    isRug: t.isRug,
    verified: t.verified || Boolean(t.launch?.verified),
    dev: t.dev ? toPublicUserDTO(t.dev) : null,
    publishedBy: t.launch ? toPublicUserDTO(t.launch.createdBy) : null,
    postsCount: countMap.get(t.id) ?? 0,
  }))
}
