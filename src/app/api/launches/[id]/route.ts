import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeLaunchStatus, getCurrentUser, getReaderId } from '@/lib/api-helpers'
import { isAdminRequest } from '@/lib/admin-auth'
import { preloadPostRefs, toPostDTO, toPublicUserDTO } from '@/lib/serializers'
import { pending } from '@/lib/counters'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { invalidate } from '@/lib/cache'
import { getIpfsImage } from '@/lib/ipfs-cache'
import { parseLaunchInput, type LaunchInput } from '@/lib/launch-input'
import { buildLaunchChangeNote } from '@/lib/launch-change-note'
import { ipfsCid } from '@/lib/remote-image'
import { getPremiumSettings, getViewer, launchAccess, premiumLaunchFields } from '@/lib/premium'
import { teamManagerIds, toMemberDTO } from '@/lib/launch-team'
import type { LaunchDetailDTO, PostDTO } from '@/lib/types'

/**
 * Quién puede editar un launch: quien lo publicó y la administración (un
 * usuario con isAdmin o una sesión del panel de admin).
 *
 * Se mira la sesión real y no getCurrentUser(): este cae en la cuenta de
 * invitado cuando no hay cookie, y un invitado no puede editar nada, ni
 * siquiera lo que figure como publicado por esa cuenta.
 */
async function canEditLaunch(req: Request, createdById: string): Promise<boolean> {
  if (isAdminRequest(req)) return true
  const userId = await sessionUserIdFromCookies()
  if (!userId) return false
  if (userId === createdById) return true
  const user = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  return Boolean(user?.isAdmin)
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const meId = await getReaderId()
    const launch = await db.launch.findUnique({
      where: { id },
      include: { createdBy: true },
    })
    if (!launch) return NextResponse.json({ error: 'Launch no encontrado' }, { status: 404 })
    // Los launches ocultos por el admin solo son visibles para admins
    if (launch.hidden && !(await canEditLaunch(req, ''))) {
      return NextResponse.json({ error: 'Launch no encontrado' }, { status: 404 })
    }

    const [posts, votes, follows, members, managers, viewer, settings] = await Promise.all([
      db.post.findMany({
        where: { launchId: launch.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.vote.findMany({ where: { userId: meId } }),
      db.follow.findMany({ where: { userId: meId } }),
      db.launchMember.findMany({
        where: { launchId: launch.id, status: { in: ['accepted', 'pending'] } },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      }),
      teamManagerIds(launch),
      getViewer(req),
      getPremiumSettings(),
    ])
    // Quien puede editar necesita ver el ticker aunque el launch sea privado: si
    // no, el formulario lo cargaría vacío y al guardar lo borraría.
    const canEdit = await canEditLaunch(req, launch.createdById)
    const likedIds = new Set(votes.filter((v) => v.target === 'post').map((v) => v.targetId))
    // Launch y token de cada post en dos consultas, no dos por post
    const postRefs = await preloadPostRefs(posts)
    const followedIds = new Set(follows.map((f) => f.targetId))

    // Equipo: los aceptados son públicos; las invitaciones pendientes solo las
    // ve quien gestiona el equipo (y cada invitado, la suya).
    const accepted = members.filter((m) => m.status === 'accepted')
    const invites = members.filter((m) => m.status === 'pending')
    const viewerId = viewer.userId
    const canManageTeam = viewer.isAdmin || (viewerId !== null && managers.has(viewerId))
    const isTeamMember = viewerId !== null && accepted.some((m) => m.userId === viewerId)
    const myInvite = viewerId ? invites.find((m) => m.userId === viewerId) : undefined
    // Los datos premium de SU launch los ve todo el equipo, sin suscripción
    const inTeam = isTeamMember || (viewerId !== null && managers.has(viewerId))
    const access = launchAccess(viewer, launch, new Set(inTeam ? [launch.id] : []))

    const dto: LaunchDetailDTO = {
      id: launch.id,
      name: launch.name,
      ticker: launch.isPrivate && !canEdit ? null : launch.ticker,
      emoji: launch.emoji,
      image: launch.image,
      banner: launch.banner,
      isPrivate: launch.isPrivate,
      hidden: launch.hidden,
      submitterRole: launch.submitterRole === 'dev' ? 'dev' : 'community',
      ...premiumLaunchFields(launch, access, settings.fields),
      network: launch.network,
      launchAt: launch.launchAt.toISOString(),
      dateConfirmed: launch.dateConfirmed,
      lastEditedAt: launch.lastEditedAt ? launch.lastEditedAt.toISOString() : null,
      lastChangeNote: launch.lastChangeNote,
      description: launch.description,
      website: launch.website,
      twitter: launch.twitter,
      telegram: launch.telegram,
      isLive: launch.isLive,
      liveUrl: launch.liveUrl,
      status: computeLaunchStatus(launch.launchAt, launch.dateConfirmed),
      hype: launch.hype + (await pending('launch:hype', launch.id)),
      hyped: votes.some((v) => v.target === 'launch' && v.targetId === launch.id),
      lpLocked: launch.lpLocked,
      mintRevoked: launch.mintRevoked,
      top10Pct: launch.top10Pct,
      verified: launch.verified,
      createdAt: launch.createdAt.toISOString(),
      createdBy: toPublicUserDTO(launch.createdBy, followedIds.has(launch.createdById)),
      postsCount: posts.length,
      canEdit,
      team: accepted.map(toMemberDTO),
      pendingInvites: canManageTeam ? invites.map(toMemberDTO) : [],
      canManageTeam,
      myInvite: myInvite ? toMemberDTO(myInvite) : null,
      isTeamMember,
      posts: (await Promise.all(
        posts.map((p) => toPostDTO(p, likedIds.has(p.id), undefined, postRefs))
      )) as PostDTO[],
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * PATCH /api/launches/<id> — editar un launch (redes, descripción, fecha,
 * imágenes…). Mismas reglas de validación que al crearlo.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const launch = await db.launch.findUnique({ where: { id } })
    if (!launch) return NextResponse.json({ error: 'Launch no encontrado' }, { status: 404 })
    if (!(await canEditLaunch(req, launch.createdById))) {
      return NextResponse.json(
        { error: 'Solo quien publicó el launch o un administrador puede editarlo' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = parseLaunchInput(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    // El formulario no tiene campo de emoji: si no llega, se conserva el que
    // hubiera (puede venir del panel de admin) en vez de pisarlo con el de serie.
    const data: Partial<LaunchInput> = { ...parsed.data }
    if (!(typeof body.emoji === 'string' && body.emoji)) delete data.emoji
    // Igual con los datos premium: un cliente que no los envía no los borra
    if (!('devWallet' in body)) delete data.devWallet
    if (!('launchpad' in body)) delete data.launchpad

    // Solo se registra como "actualización" si de verdad cambió algo visible;
    // guardar sin tocar nada no debe aparecer como actividad reciente.
    const note = buildLaunchChangeNote(launch, { ...launch, ...data })
    const updateData: typeof data & { lastEditedAt?: Date; lastChangeNote?: string } = { ...data }
    if (note) {
      updateData.lastEditedAt = new Date()
      updateData.lastChangeNote = note
    }

    const updated = await db.launch.update({ where: { id }, data: updateData })
    await invalidate('launches:*')
    // Si ha cambiado alguna imagen de IPFS, se copia ya (ver lib/ipfs-cache)
    for (const cid of [ipfsCid(updated.image), ipfsCid(updated.banner)]) {
      if (cid) void getIpfsImage(cid)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
