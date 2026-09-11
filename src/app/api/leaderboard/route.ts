import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/api-helpers'
import { cached, CACHE_TTL } from '@/lib/cache'
import { toPublicUserDTO } from '@/lib/serializers'
import { liveMarketFor, pctChange } from '@/lib/calls'
import type { ClanDTO, LeaderboardDTO, LeaderboardEntryDTO, TopCallDTO } from '@/lib/types'

const CLANS: ClanDTO[] = [
  { id: 'c1', name: 'Neón Cartel', emoji: '🟢', members: 128, score: 4820000, trend: 12.4, tag: 'CABA' },
  { id: 'c2', name: 'Noble Ventures', emoji: '🏰', members: 96, score: 3150000, trend: 8.1, tag: 'NOBL' },
  { id: 'c3', name: 'Conviction Gang', emoji: '💎', members: 214, score: 2140000, trend: -3.2, tag: 'CNVG' },
  { id: 'c4', name: 'Frog Nation', emoji: '🐸', members: 342, score: 1780000, trend: 21.7, tag: 'FROG' },
  { id: 'c5', name: 'Solana Sharks', emoji: '🦈', members: 87, score: 990000, trend: 5.5, tag: 'SHRK' },
]

/** Mejores calls por % de subida desde que se publicaron, últimos 30 días. */
async function topCalls(): Promise<TopCallDTO[]> {
  const since = new Date(Date.now() - 30 * 24 * 3600_000)
  const posts = await db.post.findMany({
    where: { kind: 'call', contract: { not: null }, entryMc: { not: null }, createdAt: { gte: since } },
    include: { user: true, launch: true, token: true },
    orderBy: { createdAt: 'desc' },
    take: 200, // de sobra para que queden los 15 mejores tras ordenar por rendimiento real
  })
  if (posts.length === 0) return []

  const market = await liveMarketFor(posts.map((p) => p.contract!))
  const withChange = posts
    .map((p) => {
      const live = market.get(p.contract!)
      const change = pctChange(p.entryMc, live?.marketCap ?? null)
      return { p, live, change }
    })
    .filter((x): x is { p: (typeof posts)[number]; live: NonNullable<typeof x.live>; change: number } => x.change !== null)
    .sort((a, b) => b.change - a.change)
    .slice(0, 15)

  return withChange.map(({ p, live, change }) => ({
    postId: p.id,
    user: toPublicUserDTO(p.user),
    content: p.content,
    createdAt: p.createdAt.toISOString(),
    projectLabel: p.launch?.ticker ? `$${p.launch.ticker}` : p.token?.ticker ? `$${p.token.ticker}` : p.launch?.name || p.token?.name || 'Token',
    call: {
      contract: p.contract!,
      network: p.network ?? 'solana',
      dexId: p.entryDexId ?? '',
      pairUrl: p.entryPairUrl ?? '',
      entryPriceUsd: p.entryPriceUsd ?? 0,
      entryMc: p.entryMc ?? 0,
      currentPriceUsd: live.priceUsd,
      currentMc: live.marketCap,
      pctChange: change,
    },
  }))
}

export async function GET() {
  try {
    const me = await getCurrentUser()
    // Solo se cachea la tabla de usuarios, que es idéntica para todos. Los
    // follows son por usuario y se consultan siempre en fresco.
    const [users, follows, calls] = await Promise.all([
      cached('leaderboard:users', CACHE_TTL.leaderboard, () =>
        db.user.findMany({ orderBy: { cabalScore: 'desc' } }),
      ),
      db.follow.findMany({ where: { userId: me.id } }),
      cached('leaderboard:top-calls', CACHE_TTL.leaderboard, topCalls),
    ])
    const followedIds = new Set(follows.map((f) => f.targetId))

    const callers: LeaderboardEntryDTO[] = [...users]
      .sort((a, b) => b.cabalScore - a.cabalScore)
      .map((u, i) => ({
        rank: i + 1,
        user: toPublicUserDTO(u, followedIds.has(u.id)),
        metric: u.cabalScore,
        winRate: u.callsTotal > 0 ? Math.round((u.callsWon / u.callsTotal) * 100) : 0,
      }))

    const devs: LeaderboardEntryDTO[] = users
      .filter((u) => u.isDev)
      .sort((a, b) => b.points - a.points)
      .map((u, i) => ({
        rank: i + 1,
        user: toPublicUserDTO(u, followedIds.has(u.id)),
        metric: u.points,
        winRate: u.callsTotal > 0 ? Math.round((u.callsWon / u.callsTotal) * 100) : 0,
      }))

    const points: LeaderboardEntryDTO[] = [...users]
      .sort((a, b) => b.points - a.points)
      .map((u, i) => ({
        rank: i + 1,
        user: toPublicUserDTO(u, followedIds.has(u.id)),
        metric: u.points,
      }))

    const dto: LeaderboardDTO = { callers, devs, points, clans: CLANS, topCalls: calls }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
