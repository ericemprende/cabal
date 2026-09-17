import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { cached, CACHE_TTL } from '@/lib/cache'
import { toPublicUserDTO } from '@/lib/serializers'
import { parsePeriod } from '@/lib/call-score'
import { kickCallResultsSync, rankCallers } from '@/lib/call-results'
import type { ClanDTO, LeaderboardDTO, LeaderboardEntryDTO } from '@/lib/types'

const CLANS: ClanDTO[] = [
  { id: 'c1', name: 'Neón Cartel', emoji: '🟢', members: 128, score: 4820000, trend: 12.4, tag: 'CABA' },
  { id: 'c2', name: 'Noble Ventures', emoji: '🏰', members: 96, score: 3150000, trend: 8.1, tag: 'NOBL' },
  { id: 'c3', name: 'Conviction Gang', emoji: '💎', members: 214, score: 2140000, trend: -3.2, tag: 'CNVG' },
  { id: 'c4', name: 'Frog Nation', emoji: '🐸', members: 342, score: 1780000, trend: 21.7, tag: 'FROG' },
  { id: 'c5', name: 'Solana Sharks', emoji: '🦈', members: 87, score: 990000, trend: 5.5, tag: 'SHRK' },
]

// GET /api/leaderboard?period=24h|7d|30d|all — el periodo solo afecta a Top Callers
export async function GET(req: Request) {
  try {
    const period = parsePeriod(new URL(req.url).searchParams.get('period'))
    // Mantiene al día los resultados de las calls sin hacer esperar a nadie
    kickCallResultsSync()

    // Público: sin sesión también se ve (antes getCurrentUser fallaba sin cuenta)
    const viewerId = await sessionUserIdFromCookies()
    // Solo se cachea lo que es idéntico para todos. Los follows son por
    // usuario y se consultan siempre en fresco.
    const [users, ranking, follows] = await Promise.all([
      cached('leaderboard:users', CACHE_TTL.leaderboard, () =>
        db.user.findMany({ orderBy: { points: 'desc' } }),
      ),
      cached(`leaderboard:callers:${period}`, 60, () => rankCallers(period)),
      viewerId ? db.follow.findMany({ where: { userId: viewerId } }) : Promise.resolve([]),
    ])
    const followedIds = new Set(follows.map((f) => f.targetId))
    const userById = new Map(users.map((u) => [u.id, u]))

    const callers: LeaderboardEntryDTO[] = ranking
      .filter((r) => userById.has(r.userId))
      .slice(0, 100)
      .map((r, i) => ({
        rank: i + 1,
        user: toPublicUserDTO(userById.get(r.userId)!, followedIds.has(r.userId)),
        metric: r.summary.score,
        winRate: r.summary.winRate,
        calls: r.summary,
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

    const dto: LeaderboardDTO = { period, callers, devs, points, clans: CLANS }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
