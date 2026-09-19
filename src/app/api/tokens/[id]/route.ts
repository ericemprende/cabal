import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateChart, getReaderId } from '@/lib/api-helpers'
import { preloadPostRefs, toPostDTO, toPublicUserDTO } from '@/lib/serializers'
import type { TokenDetailDTO } from '@/lib/types'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const meId = await getReaderId()
    const token = await db.token.findUnique({
      where: { id },
      include: { dev: true, launch: { include: { createdBy: true } } },
    })
    if (!token) return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 })

    const [posts, votes, follows, devTokens] = await Promise.all([
      db.post.findMany({
        where: { tokenId: token.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.vote.findMany({ where: { userId: meId } }),
      db.follow.findMany({ where: { userId: meId } }),
      // Sin dev no hay historial. Ojo: un where { devId: null } devolvería todos
      // los tokens sin dev, como si fueran de esta persona.
      token.devId
        ? db.token.findMany({ where: { devId: token.devId }, orderBy: { launchedAt: 'desc' } })
        : Promise.resolve([]),
    ])
    const likedIds = new Set(votes.filter((v) => v.target === 'post').map((v) => v.targetId))
    // Launch y token de cada post en dos consultas, no dos por post
    const postRefs = await preloadPostRefs(posts)
    const followedIds = new Set(follows.map((f) => f.targetId))

    // dev track record: retention vs ATH (%)
    const retention = (t: (typeof devTokens)[number]) => {
      if (!t.athMc || t.athMc <= 0) return 0
      return Math.round((t.mc / t.athMc) * 100)
    }
    const avgPerformance =
      devTokens.length > 0
        ? Math.round(devTokens.reduce((acc, t) => acc + retention(t), 0) / devTokens.length)
        : 0

    const dto: TokenDetailDTO = {
      id: token.id,
      name: token.name,
      ticker: token.ticker,
      emoji: token.emoji,
      image: token.image,
      network: token.network,
      price: token.price,
      mc: token.mc,
      change24h: token.change24h,
      volume24h: token.volume24h,
      holders: token.holders,
      top10Pct: token.top10Pct,
      contract: token.contract,
      launchedAt: token.launchedAt.toISOString(),
      athMc: token.athMc,
      isRug: token.isRug,
      verified: token.verified || Boolean(token.launch?.verified),
      dev: token.dev ? toPublicUserDTO(token.dev, followedIds.has(token.dev.id)) : null,
      publishedBy: token.launch
        ? toPublicUserDTO(token.launch.createdBy, followedIds.has(token.launch.createdById))
        : null,
      postsCount: posts.length,
      chart: generateChart(token.id, token.mc, token.change24h, token.isRug),
      posts: (await Promise.all(posts.map((p) => toPostDTO(p, likedIds.has(p.id), undefined, postRefs)))) ?? [],
      devHistory: devTokens.map((t) => ({
        id: t.id,
        name: t.name,
        ticker: t.ticker,
        emoji: t.emoji,
        mc: t.mc,
        athMc: t.athMc,
        change24h: t.change24h,
        isRug: t.isRug,
        launchedAt: t.launchedAt.toISOString(),
      })),
      devStats: {
        tokensLaunched: devTokens.length,
        rugs: devTokens.filter((t) => t.isRug).length,
        avgPerformance: Math.round(avgPerformance * 10) / 10,
      },
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
