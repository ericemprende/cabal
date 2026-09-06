import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeLaunchStatus, getCurrentUser } from '@/lib/api-helpers'
import { isAdminRequest } from '@/lib/admin-auth'
import { toPostDTO, toUserDTO } from '@/lib/serializers'
import type { LaunchDetailDTO, PostDTO } from '@/lib/types'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await getCurrentUser()
    const launch = await db.launch.findUnique({
      where: { id },
      include: { createdBy: true },
    })
    if (!launch) return NextResponse.json({ error: 'Launch no encontrado' }, { status: 404 })
    // Los launches ocultos por el admin solo son visibles para admins
    if (launch.hidden && !me.isAdmin && !isAdminRequest(req)) {
      return NextResponse.json({ error: 'Launch no encontrado' }, { status: 404 })
    }

    const [posts, votes, follows] = await Promise.all([
      db.post.findMany({
        where: { launchId: launch.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.vote.findMany({ where: { userId: me.id } }),
      db.follow.findMany({ where: { userId: me.id } }),
    ])
    const likedIds = new Set(votes.filter((v) => v.target === 'post').map((v) => v.targetId))
    const followedIds = new Set(follows.map((f) => f.targetId))

    const dto: LaunchDetailDTO = {
      id: launch.id,
      name: launch.name,
      ticker: launch.isPrivate && launch.createdById !== me.id && !me.isAdmin ? null : launch.ticker,
      emoji: launch.emoji,
      image: launch.image,
      banner: launch.banner,
      isPrivate: launch.isPrivate,
      hidden: launch.hidden,
      submitterRole: launch.submitterRole === 'dev' ? 'dev' : 'community',
      contract: launch.contract,
      network: launch.network,
      launchAt: launch.launchAt.toISOString(),
      description: launch.description,
      website: launch.website,
      twitter: launch.twitter,
      telegram: launch.telegram,
      isLive: launch.isLive,
      liveUrl: launch.liveUrl,
      status: computeLaunchStatus(launch.launchAt),
      hype: launch.hype,
      hyped: votes.some((v) => v.target === 'launch' && v.targetId === launch.id),
      lpLocked: launch.lpLocked,
      mintRevoked: launch.mintRevoked,
      top10Pct: launch.top10Pct,
      createdAt: launch.createdAt.toISOString(),
      createdBy: toUserDTO(launch.createdBy, followedIds.has(launch.createdById)),
      postsCount: posts.length,
      posts: (await Promise.all(
        posts.map((p) => toPostDTO(p, likedIds.has(p.id)))
      )) as PostDTO[],
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
