import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { toPublicUserDTO } from '@/lib/serializers'
import type { PublicUserDTO } from '@/lib/types'

/** Tope de la lista: más no se lee en un diálogo, y evita respuestas enormes. */
const LIMIT = 200

/**
 * GET /api/users/<handle>/follows?type=followers|following
 * Quién sigue a un usuario, o a quién sigue él. Pública, como el perfil.
 * `isFollowed` de cada persona es respecto a quien mira la lista.
 */
export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle: raw } = await params
    const handle = decodeURIComponent(raw).replace(/^@+/, '').trim()
    const type = new URL(req.url).searchParams.get('type') === 'following' ? 'following' : 'followers'

    const user = await db.user.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const people =
      type === 'followers'
        ? (
            await db.follow.findMany({
              where: { targetId: user.id },
              include: { user: true },
              take: LIMIT,
            })
          ).map((f) => f.user)
        : (
            await db.follow.findMany({
              where: { userId: user.id },
              include: { target: true },
              take: LIMIT,
            })
          ).map((f) => f.target)

    const viewerId = await sessionUserIdFromCookies()
    const viewerFollows = viewerId
      ? new Set(
          (
            await db.follow.findMany({
              where: { userId: viewerId, targetId: { in: people.map((p) => p.id) } },
              select: { targetId: true },
            })
          ).map((f) => f.targetId)
        )
      : new Set<string>()

    const users: PublicUserDTO[] = people.map((p) => toPublicUserDTO(p, viewerFollows.has(p.id)))
    return NextResponse.json({ users })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
