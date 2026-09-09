import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import type { WaitlistEntryDTO } from '@/lib/types'

const STATUSES = ['pending', 'approved', 'rejected'] as const

/**
 * GET /api/admin/waitlist
 * Listado completo de la lista de espera + contadores por estado.
 * ?status=pending|approved|rejected  ?q=<handle o nombre>
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const q = url.searchParams.get('q')?.trim()
    // Por defecto se ocultan los que abandonaron en el formulario; ?all=1 los muestra
    const showAll = url.searchParams.get('all') === '1'

    const entries = await db.waitlistEntry.findMany({
      where: {
        ...(showAll ? {} : { completed: true }),
        ...(status && STATUSES.includes(status as (typeof STATUSES)[number]) ? { status } : {}),
        ...(q
          ? {
              OR: [
                { xHandle: { contains: q, mode: 'insensitive' as const } },
                { xName: { contains: q, mode: 'insensitive' as const } },
                { email: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
    })

    const counts = await db.waitlistEntry.groupBy({ by: ['status'], _count: { _all: true } })
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))
    const sharedCount = await db.waitlistEntry.count({ where: { shared: true } })
    const incomplete = await db.waitlistEntry.count({ where: { completed: false } })

    const rows: WaitlistEntryDTO[] = entries.map((e, i) => ({
      id: e.id,
      position: i + 1,
      xId: e.xId,
      xHandle: e.xHandle,
      xName: e.xName,
      xAvatar: e.xAvatar,
      xFollowers: e.xFollowers,
      xVerified: e.xVerified,
      xCreatedAt: e.xCreatedAt?.toISOString() ?? null,
      userId: e.userId,
      email: e.email,
      telegram: e.telegram,
      wallet: e.wallet,
      country: e.country,
      reason: e.reason,
      completed: e.completed,
      completedAt: e.completedAt?.toISOString() ?? null,
      status: e.status,
      shared: e.shared,
      sharedAt: e.sharedAt?.toISOString() ?? null,
      referredBy: e.referredBy,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
      approvedAt: e.approvedAt?.toISOString() ?? null,
    }))

    return NextResponse.json({
      entries: rows,
      stats: {
        total: rows.length,
        pending: byStatus.pending ?? 0,
        approved: byStatus.approved ?? 0,
        rejected: byStatus.rejected ?? 0,
        shared: sharedCount,
        incomplete,
      },
    })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/waitlist
 * Habilita/rechaza manualmente una entrada, o guarda una nota interna.
 * Body: { id | ids: string[], status?, note? }
 */
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req)
    const body = (await req.json()) as {
      id?: string
      ids?: string[]
      status?: string
      note?: string
    }
    const ids = body.ids?.length ? body.ids : body.id ? [body.id] : []
    if (!ids.length) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
      }
      data.status = body.status
      data.approvedAt = body.status === 'approved' ? new Date() : null
    }
    if (typeof body.note === 'string') data.note = body.note.slice(0, 300)
    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const result = await db.waitlistEntry.updateMany({ where: { id: { in: ids } }, data })
    return NextResponse.json({ ok: true, updated: result.count })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** DELETE /api/admin/waitlist?id=… — borra una entrada (spam evidente). */
export async function DELETE(req: Request) {
  try {
    await requireAdmin(req)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await db.waitlistEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
