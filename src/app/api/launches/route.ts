import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, computeLaunchStatus, getCurrentUser } from '@/lib/api-helpers'
import { toPublicUserDTO } from '@/lib/serializers'
import { cached, CACHE_TTL, invalidate } from '@/lib/cache'
import { pendingMany } from '@/lib/counters'
import type { LaunchDTO } from '@/lib/types'
import { parseLaunchInput } from '@/lib/launch-input'
import { getIpfsImage } from '@/lib/ipfs-cache'
import { ipfsCid } from '@/lib/remote-image'
import { getPremiumSettings, getViewer, launchAccess, premiumLaunchFields, teamLaunchIdsOf } from '@/lib/premium'

export async function GET(req: Request) {
  try {
    const me = await getCurrentUser()
    const [launches, votes, follows, postCounts, viewer, settings] = await Promise.all([
      // Compartido entre todos los usuarios -> cacheable. Los votos y follows
      // de más abajo son personales y se leen siempre en fresco. Los datos
      // premium también viajan en la caché: se filtran por usuario más abajo.
      cached('launches:visible', CACHE_TTL.launch, () =>
        db.launch.findMany({
          where: { hidden: false },
          include: { createdBy: true },
          orderBy: { launchAt: 'asc' },
        }),
      ),
      db.vote.findMany({ where: { userId: me.id, target: 'launch' } }),
      db.follow.findMany({ where: { userId: me.id } }),
      db.post.groupBy({ by: ['launchId'], _count: { _all: true } }),
      getViewer(req),
      getPremiumSettings(),
    ])
    const hypedIds = new Set(votes.map((v) => v.targetId))
    const followedIds = new Set(follows.map((f) => f.targetId))
    const countMap = new Map(postCounts.filter((p) => p.launchId).map((p) => [p.launchId!, p._count._all]))
    // Deltas de hype todavía en Redis, en una sola llamada (§4.2).
    const hypeDelta = await pendingMany('launch:hype', launches.map((l) => l.id))
    const teamIds = await teamLaunchIdsOf(viewer.userId)

    const dto: LaunchDTO[] = launches.map((l) => ({
      id: l.id,
      name: l.name,
      ticker: l.isPrivate ? null : l.ticker,
      emoji: l.emoji,
      image: l.image,
      banner: l.banner,
      isPrivate: l.isPrivate,
      hidden: l.hidden,
      submitterRole: l.submitterRole === 'dev' ? 'dev' : 'community',
      ...premiumLaunchFields(l, launchAccess(viewer, l, teamIds), settings.fields),
      network: l.network,
      launchAt: new Date(l.launchAt).toISOString(),
      dateConfirmed: l.dateConfirmed,
      description: l.description,
      website: l.website,
      twitter: l.twitter,
      telegram: l.telegram,
      isLive: l.isLive,
      liveUrl: l.liveUrl,
      status: computeLaunchStatus(new Date(l.launchAt)),
      hype: l.hype + (hypeDelta[l.id] ?? 0),
      hyped: hypedIds.has(l.id),
      lpLocked: l.lpLocked,
      mintRevoked: l.mintRevoked,
      top10Pct: l.top10Pct,
      createdAt: new Date(l.createdAt).toISOString(),
      createdBy: toPublicUserDTO(l.createdBy, followedIds.has(l.createdById)),
      postsCount: countMap.get(l.id) ?? 0,
    }))
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    const body = await req.json()
    const parsed = parseLaunchInput(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const launch = await db.launch.create({
      data: { ...parsed.data, createdById: me.id },
      include: { createdBy: true },
    })
    const pointsEarned = await awardPoints(
      me.id,
      'launch',
      `Publicaste el launch: ${launch.name}${launch.ticker ? ` (${launch.ticker})` : ' (privado)'}`
    )
    await invalidate('launches:*')
    // Copia de las imágenes de IPFS hecha ya, para que quien abra la ficha no
    // espere a las pasarelas. Sin await: si falla, se copiarán al primer uso.
    for (const cid of [ipfsCid(launch.image), ipfsCid(launch.banner)]) {
      if (cid) void getIpfsImage(cid)
    }
    return NextResponse.json({ ok: true, pointsEarned }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
