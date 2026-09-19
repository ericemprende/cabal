import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { cached, CACHE_TTL } from '@/lib/cache'
import { toPublicUserDTO } from '@/lib/serializers'
import { parsePeriod } from '@/lib/call-score'
import { kickCallResultsSync, rankCallers } from '@/lib/call-results'
import { chatLinkIdsOf, communityBoard, listCommunities, parseCommunityKey } from '@/lib/bot-community'
import type { ClanDTO, LeaderboardDTO, LeaderboardEntryDTO } from '@/lib/types'

/**
 * GET /api/leaderboard?period=24h|7d|30d|all&community=<clave>
 *
 * El periodo y la comunidad solo afectan a Top Callers. Con `community` el
 * ranking se limita a las calls nacidas en ese grupo o servidor (ver
 * lib/bot-community); sin ella, sale el de todo Cabal.
 */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams
    const period = parsePeriod(params.get('period'))
    const community = parseCommunityKey(params.get('community')) ? params.get('community') : null
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
      cached(`leaderboard:callers:${period}:${community ?? 'all'}`, 60, async () =>
        rankCallers(period, community ? await chatLinkIdsOf(community) : undefined)
      ),
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

    const communities = await cached('leaderboard:communities', 300, listCommunities)
    // Clanes = las comunidades de Telegram/Discord que ya usan el bot, con las
    // estadísticas de sus calls. Se cachea porque consulta a los dos bots.
    const clans: ClanDTO[] = (await cached(`leaderboard:clans:${period}`, 300, () => communityBoard(period))).map((c) => ({
      key: c.key,
      name: c.label,
      provider: c.provider,
      chats: c.chats,
      members: c.members,
      online: c.online,
      link: c.link,
      callers: c.callers,
      score: c.summary.score,
      calls: c.summary.calls,
      wins: c.summary.wins,
      winRate: c.summary.winRate,
      bestMultiple: c.summary.bestMultiple,
      avgPeak: c.summary.avgPeak,
      topCallers: c.topCallers,
      lastCallAt: c.lastCallAt,
    }))
    const dto: LeaderboardDTO = {
      period,
      community,
      communities: communities.map((c) => ({ key: c.key, label: c.label, provider: c.provider, calls: c.calls })),
      callers,
      devs,
      points,
      clans,
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
