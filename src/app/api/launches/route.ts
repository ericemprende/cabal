import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, computeLaunchStatus, getCurrentUser } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'
import type { LaunchDTO } from '@/lib/types'

export async function GET() {
  try {
    const me = await getCurrentUser()
    const [launches, votes, follows, postCounts] = await Promise.all([
      db.launch.findMany({
        where: { hidden: false },
        include: { createdBy: true },
        orderBy: { launchAt: 'asc' },
      }),
      db.vote.findMany({ where: { userId: me.id, target: 'launch' } }),
      db.follow.findMany({ where: { userId: me.id } }),
      db.post.groupBy({ by: ['launchId'], _count: { _all: true } }),
    ])
    const hypedIds = new Set(votes.map((v) => v.targetId))
    const followedIds = new Set(follows.map((f) => f.targetId))
    const countMap = new Map(postCounts.filter((p) => p.launchId).map((p) => [p.launchId!, p._count._all]))

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
      contract: l.contract,
      network: l.network,
      launchAt: l.launchAt.toISOString(),
      description: l.description,
      website: l.website,
      twitter: l.twitter,
      telegram: l.telegram,
      status: computeLaunchStatus(l.launchAt),
      hype: l.hype,
      hyped: hypedIds.has(l.id),
      lpLocked: l.lpLocked,
      mintRevoked: l.mintRevoked,
      top10Pct: l.top10Pct,
      createdAt: l.createdAt.toISOString(),
      createdBy: toUserDTO(l.createdBy, followedIds.has(l.createdById)),
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
    const { name, ticker, emoji, network, launchAt, description, website, twitter, telegram, image, banner, isPrivate, submitterRole, contract } = body
    if (!name || !network || !launchAt) {
      return NextResponse.json({ error: 'Faltan campos requeridos (nombre, red y fecha)' }, { status: 400 })
    }
    const when = new Date(launchAt)
    if (isNaN(when.getTime())) {
      return NextResponse.json({ error: 'Fecha de lanzamiento inválida' }, { status: 400 })
    }
    // El ticker es opcional: se puede anunciar un launch sin revelarlo (modo privado)
    const cleanTicker = typeof ticker === 'string' && ticker.trim() ? ticker.trim().slice(0, 12).toUpperCase() : null
    const priv = Boolean(isPrivate)
    if (!priv && !cleanTicker) {
      return NextResponse.json(
        { error: 'Ingresa el ticker o marca el lanzamiento como privado' },
        { status: 400 }
      )
    }
    const safeUrl = (v: unknown) =>
      typeof v === 'string' && (v.startsWith('/uploads/') || v.startsWith('/seed/') || v.startsWith('https://'))
        ? v.slice(0, 500)
        : null
    // ¿Quién publica? dev = el propio dev postula su proyecto | community = alguien que encontró la info
    const role = submitterRole === 'dev' ? 'dev' : 'community'
    const cleanContract =
      typeof contract === 'string' && /^[a-zA-Z0-9:_-]{2,80}$/.test(contract.trim()) ? contract.trim() : null
    const launch = await db.launch.create({
      data: {
        name: String(name).slice(0, 60),
        ticker: cleanTicker,
        emoji: (emoji || '🚀').slice(0, 8),
        image: safeUrl(image),
        banner: safeUrl(banner),
        isPrivate: priv,
        submitterRole: role,
        contract: cleanContract,
        network,
        launchAt: when,
        description: String(description || '').slice(0, 800),
        website: website || null,
        twitter: twitter || null,
        telegram: telegram || null,
        createdById: me.id,
      },
      include: { createdBy: true },
    })
    const pointsEarned = await awardPoints(
      me.id,
      'launch',
      `Publicaste el launch: ${launch.name}${launch.ticker ? ` (${launch.ticker})` : ' (privado)'}`
    )
    return NextResponse.json({ ok: true, pointsEarned }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
