import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeLaunchStatus } from '@/lib/api-helpers'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { publicDevClaim } from '@/lib/claims'
import { pendingMany } from '@/lib/counters'
import { preloadPostRefs, toPostDTO, toPublicUserDTO } from '@/lib/serializers'
import { hasPremium } from '@/lib/premium'
import { computeBadges, isFounder } from '@/lib/badges'
import type { PostDTO, PublicProfileDTO } from '@/lib/types'

/**
 * GET /api/users/<handle> — perfil público de un usuario.
 *
 * Lo puede ver cualquiera, con o sin cuenta. Por eso no usa getCurrentUser():
 * en producción no hay cuenta de invitado y sin sesión lanzaría un error, lo
 * que dejaría el perfil roto para quien llega desde un enlace. La sesión solo
 * se usa para saber si quien mira es el propio usuario y a quién sigue.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle: raw } = await params
    const handle = decodeURIComponent(raw).replace(/^@+/, '').trim()
    if (!/^\w{1,30}$/.test(handle)) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const user = await db.user.findFirst({ where: { handle: { equals: handle, mode: 'insensitive' } } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const viewerId = await sessionUserIdFromCookies()
    const isMe = viewerId === user.id

    const [
      launches,
      tokens,
      devClaims,
      posts,
      followers,
      following,
      postsCount,
      theses,
      launchesCount,
      viewer,
      premium,
      likesReceived,
      hypesGiven,
      founder,
    ] = await Promise.all([
      db.launch.findMany({
        where: { createdById: user.id, hidden: false },
        orderBy: { launchAt: 'desc' },
        take: 30,
      }),
      db.token.findMany({ where: { devId: user.id }, orderBy: { launchedAt: 'desc' } }),
      db.devClaim.findMany({
        where: { userId: user.id, status: 'verified' },
        orderBy: { verifiedAt: 'desc' },
      }),
      db.post.findMany({
        where: { userId: user.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      db.follow.count({ where: { targetId: user.id } }),
      db.follow.count({ where: { userId: user.id } }),
      db.post.count({ where: { userId: user.id } }),
      db.post.count({ where: { userId: user.id, kind: 'thesis' } }),
      db.launch.count({ where: { createdById: user.id, hidden: false } }),
      // ¿Quien mira sigue a este usuario?
      viewerId
        ? db.follow.findUnique({ where: { userId_targetId: { userId: viewerId, targetId: user.id } } })
        : Promise.resolve(null),
      hasPremium(user.id),
      db.post.aggregate({ where: { userId: user.id }, _sum: { likes: true } }),
      db.vote.count({ where: { userId: user.id, target: 'launch' } }),
      isFounder(user.createdAt),
    ])
    const badges = computeBadges({
      createdAt: user.createdAt,
      isDev: user.isDev,
      walletVerified: user.walletVerified,
      isFounder: founder,
      stats: {
        launchesCount,
        thesesCount: theses,
        postsCount,
        likesReceived: likesReceived._sum.likes ?? 0,
        hypesGiven,
      },
    })

    // Solo los "me gusta" de quien mira sobre estos posts, no todos los suyos
    const likes = viewerId
      ? await db.vote.findMany({
          where: { userId: viewerId, target: 'post', targetId: { in: posts.map((p) => p.id) } },
          select: { targetId: true },
        })
      : []
    const likedIds = new Set(likes.map((v) => v.targetId))
    // Launch y token de cada post en dos consultas, no dos por post
    const postRefs = await preloadPostRefs(posts)
    const hypes = await pendingMany(
      'launch:hype',
      launches.map((l) => l.id)
    )

    const dto: PublicProfileDTO = {
      user: toPublicUserDTO(user, Boolean(viewer)),
      joinedAt: user.createdAt.toISOString(),
      isMe,
      premium,
      badges,
      counts: {
        followers,
        following,
        posts: postsCount,
        theses,
        launches: launchesCount,
        tokens: tokens.length,
      },
      launches: launches.map((l) => ({
        id: l.id,
        name: l.name,
        // Un launch privado no revela su ticker a nadie más que a quien lo publicó
        ticker: l.isPrivate && !isMe ? null : l.ticker,
        emoji: l.emoji,
        image: l.image,
        isPrivate: l.isPrivate,
        network: l.network,
        launchAt: l.launchAt.toISOString(),
        status: computeLaunchStatus(l.launchAt, l.dateConfirmed),
        hype: l.hype + (hypes[l.id] ?? 0),
      })),
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        ticker: t.ticker,
        emoji: t.emoji,
        image: t.image,
        network: t.network,
        mc: t.mc,
        athMc: t.athMc,
        change24h: t.change24h,
        isRug: t.isRug,
        launchedAt: t.launchedAt.toISOString(),
      })),
      devClaims: devClaims.map(publicDevClaim),
      posts: (await Promise.all(
        posts.map((p) => toPostDTO(p, likedIds.has(p.id), undefined, postRefs))
      )) as PostDTO[],
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
