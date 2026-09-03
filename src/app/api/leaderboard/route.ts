import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import type { ClanDTO, LeaderboardDTO, LeaderboardEntryDTO } from '@/lib/types'

const CLANS: ClanDTO[] = [
  { id: 'c1', name: 'Neón Cartel', emoji: '🟢', members: 128, score: 4820000, trend: 12.4, tag: 'CABA' },
  { id: 'c2', name: 'Noble Ventures', emoji: '🏰', members: 96, score: 3150000, trend: 8.1, tag: 'NOBL' },
  { id: 'c3', name: 'Conviction Gang', emoji: '💎', members: 214, score: 2140000, trend: -3.2, tag: 'CNVG' },
  { id: 'c4', name: 'Frog Nation', emoji: '🐸', members: 342, score: 1780000, trend: 21.7, tag: 'FROG' },
  { id: 'c5', name: 'Solana Sharks', emoji: '🦈', members: 87, score: 990000, trend: 5.5, tag: 'SHRK' },
]

export async function GET() {
  try {
    const me = await getCurrentUser()
    const [users, follows] = await Promise.all([
      db.user.findMany({ orderBy: { cabalScore: 'desc' } }),
      db.follow.findMany({ where: { userId: me.id } }),
    ])
    const followedIds = new Set(follows.map((f) => f.targetId))

    const callers: LeaderboardEntryDTO[] = [...users]
      .sort((a, b) => b.cabalScore - a.cabalScore)
      .map((u, i) => ({
        rank: i + 1,
        user: toUserDTO(u, followedIds.has(u.id)),
        metric: u.cabalScore,
        winRate: u.callsTotal > 0 ? Math.round((u.callsWon / u.callsTotal) * 100) : 0,
      }))

    const devs: LeaderboardEntryDTO[] = users
      .filter((u) => u.isDev)
      .sort((a, b) => b.points - a.points)
      .map((u, i) => ({
        rank: i + 1,
        user: toUserDTO(u, followedIds.has(u.id)),
        metric: u.points,
        winRate: u.callsTotal > 0 ? Math.round((u.callsWon / u.callsTotal) * 100) : 0,
      }))

    const points: LeaderboardEntryDTO[] = [...users]
      .sort((a, b) => b.points - a.points)
      .map((u, i) => ({
        rank: i + 1,
        user: toUserDTO(u, followedIds.has(u.id)),
        metric: u.points,
      }))

    const dto: LeaderboardDTO = { callers, devs, points, clans: CLANS }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
