import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getPointRules } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import { premiumStatus } from '@/lib/premium'
import { computeBadges, computeNextBadges, isFounder, tradeVolumeUsd } from '@/lib/badges'
import type { DevClaimStats, MeDTO } from '@/lib/types'

export async function GET() {
  try {
    const me = await getCurrentUser()
    const [
      followed,
      pointEvents,
      rules,
      postCount,
      thesesCount,
      launchCount,
      hypes,
      likesReceived,
      wallets,
      devClaims,
      premium,
    ] = await Promise.all([
      db.follow.findMany({ where: { userId: me.id } }),
      db.pointEvent.findMany({
        where: { userId: me.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      getPointRules(),
      db.post.count({ where: { userId: me.id } }),
      db.post.count({ where: { userId: me.id, kind: 'thesis' } }),
      db.launch.count({ where: { createdById: me.id } }),
      db.vote.count({ where: { userId: me.id, target: 'launch', kind: 'hype' } }),
      db.post.aggregate({ where: { userId: me.id }, _sum: { likes: true } }),
      db.walletLink.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' } }),
      db.devClaim.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' } }),
      premiumStatus(me.id, me.isAdmin),
    ])
    const followedIds = new Set(followed.map((f) => f.targetId))
    // El pico más alto de sus calls: es lo único de las insignias que no está
    // ya en el usuario (callsWon/callsTotal los guarda refreshUserCallTotals).
    const mejorCall = await db.post.aggregate({
      where: { userId: me.id, kind: 'call' },
      _max: { peakMultiple: true },
    })
    const badgeCtx = {
      createdAt: me.createdAt,
      isDev: me.isDev,
      walletVerified: me.walletVerified,
      isFounder: await isFounder(me.createdAt),
      stats: {
        launchesCount: launchCount,
        thesesCount,
        postsCount: postCount,
        likesReceived: likesReceived._sum.likes ?? 0,
        hypesGiven: hypes,
        tradeVolumeUsd: await tradeVolumeUsd(me.id),
      },
      calls: { won: me.callsWon, total: me.callsTotal, best: mejorCall._max.peakMultiple },
      rep: { score: me.repScore, votes: me.repUp + me.repDown },
    }
    const badges = computeBadges(badgeCtx)
    const nextBadges = computeNextBadges(badgeCtx)

    // rank by points
    const pointsRank = (await db.user.count({ where: { points: { gt: me.points } } })) + 1

    const dto: MeDTO = {
      ...toUserDTO(me, followedIds.has(me.id)),
      isAdmin: me.isAdmin,
      pointsRank,
      pointEvents: pointEvents.map((e) => ({
        id: e.id,
        amount: e.amount,
        reason: e.reason,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
      pointRules: rules,
      stats: {
        postsCount: postCount,
        launchesCount: launchCount,
        hypesGiven: hypes,
        likesReceived: likesReceived._sum.likes ?? 0,
      },
      wallets: wallets.map((w) => ({
        id: w.id,
        network: w.network,
        address: w.address,
        label: w.label,
        signature: w.signature,
        createdAt: w.createdAt.toISOString(),
      })),
      devClaims: devClaims.map((c) => ({
        id: c.id,
        network: c.network,
        contract: c.contract,
        walletAddress: c.walletAddress,
        name: c.name,
        symbol: c.symbol,
        status: c.status,
        note: c.note,
        stats: parseClaimStats(c.stats),
        source: c.source,
        createdAt: c.createdAt.toISOString(),
        verifiedAt: c.verifiedAt?.toISOString() ?? null,
      })),
      premium,
      badges,
      nextBadges,
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

function parseClaimStats(raw: string): DevClaimStats | null {
  try {
    const obj = JSON.parse(raw) as DevClaimStats
    return obj && Object.keys(obj).length > 0 ? obj : null
  } catch {
    return null
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await getCurrentUser()
    const body = await req.json()
    const data: Record<string, string | boolean> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 40)
    if (typeof body.bio === 'string') data.bio = body.bio.slice(0, 200)
    // Avatar: emoji corto O URL de imagen (https://, /uploads/, /seed/)
    if (typeof body.avatar === 'string') {
      const a = body.avatar.trim()
      const isUrl = /^https:\/\/\S+$/i.test(a) || a.startsWith('/uploads/') || a.startsWith('/seed/')
      if (isUrl && a.length <= 500) data.avatar = a
      else if (!isUrl && a.length > 0 && a.length <= 8) data.avatar = a
    }
    if (typeof body.wallet === 'string') {
      const w = body.wallet.trim()
      data.wallet = w.length >= 20 ? w : null
      if (w.length >= 20 && !me.walletVerified) data.walletVerified = true
    }
    if (typeof body.notifyEmail === 'boolean') data.notifyEmail = body.notifyEmail
    if (typeof body.showTrackRecord === 'boolean') data.showTrackRecord = body.showTrackRecord
    const updated = await db.user.update({ where: { id: me.id }, data })
    return NextResponse.json({ ok: true, user: toUserDTO(updated) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
