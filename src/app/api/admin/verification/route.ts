import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { invalidate } from '@/lib/cache'
import { hasPremium } from '@/lib/premium'
import { serializeVerifyRequest } from '@/lib/verification'

// GET: solicitudes de verificación, las pendientes primero
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const rows = await db.verificationRequest.findMany({
      include: {
        launch: { select: { id: true, name: true, ticker: true } },
        user: { select: { id: true, handle: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    rows.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
    return NextResponse.json(rows.map(serializeVerifyRequest))
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// PATCH { id, action: approve | reject }: aprobar da la insignia vía Premium
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req)
    const body = (await req.json()) as { id?: string; action?: string }
    const row = body.id ? await db.verificationRequest.findUnique({ where: { id: body.id } }) : null
    if (!row) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    if (body.action !== 'approve' && body.action !== 'reject') {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }
    const approve = body.action === 'approve'
    // Si ya no tiene Premium al aprobar, queda marcada pero apagada hasta que renueve
    const active = approve ? await hasPremium(row.userId) : false
    // Una verificación del admin (permanente) no se rebaja a Premium
    const grant = !approve
      ? []
      : row.kind === 'launch' && row.launchId
        ? [
            db.launch.updateMany({
              where: { id: row.launchId, NOT: { verifiedVia: 'admin' } },
              data: { verified: active, verifiedVia: 'premium' },
            }),
          ]
        : [
            db.user.updateMany({
              where: { id: row.userId, NOT: { verifiedVia: 'admin' } },
              data: { verified: active, verifiedVia: 'premium' },
            }),
          ]
    await db.$transaction([
      db.verificationRequest.update({
        where: { id: row.id },
        data: { status: approve ? 'approved' : 'rejected', reviewedAt: new Date() },
      }),
      ...grant,
    ])
    if (approve && row.kind === 'launch') await invalidate('launches:*')
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
