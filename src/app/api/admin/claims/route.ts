import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'

// GET /api/admin/claims — cola de reclamos de proyectos (con usuario y proyecto)
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const claims = await db.projectClaim.findMany({ orderBy: { createdAt: 'desc' } })
    const [users, launches, tokens] = await Promise.all([
      db.user.findMany(),
      db.launch.findMany(),
      db.token.findMany(),
    ])
    const enriched = claims.map((c) => {
      const user = users.find((u) => u.id === c.userId)
      const proj =
        c.targetType === 'launch'
          ? launches.find((l) => l.id === c.targetId)
          : tokens.find((t) => t.id === c.targetId)
      return {
        id: c.id,
        targetType: c.targetType,
        network: c.network,
        contract: c.contract,
        wallet: c.wallet,
        status: c.status,
        method: c.method,
        note: c.note,
        createdAt: c.createdAt,
        userName: user?.name ?? user?.handle ?? '¿?',
        userHandle: user?.handle ?? '',
        projectName: proj?.name ?? 'Proyecto',
        projectTicker: (proj as { ticker?: string | null } | undefined)?.ticker ?? null,
      }
    })
    return NextResponse.json({ claims: enriched })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/admin/claims — aprobar o rechazar un reclamo
// Body: { id, action: 'approve' | 'reject' }
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json()
    const id = String(body.id ?? '')
    const action = String(body.action ?? '')
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'id y action (approve|reject) requeridos' }, { status: 400 })
    }
    const claim = await db.projectClaim.findUnique({ where: { id } })
    if (!claim) return NextResponse.json({ error: 'Reclamo no encontrado' }, { status: 404 })

    const status = action === 'approve' ? 'verified' : 'rejected'
    const updated = await db.projectClaim.update({
      where: { id },
      data: {
        status,
        method: action === 'approve' ? 'admin' : claim.method,
        verifiedAt: action === 'approve' ? new Date() : null,
        note:
          action === 'approve'
            ? 'Aprobado por el admin'
            : 'Rechazado por el admin',
      },
    })

    // Al aprobar un token: vínculalo como dev del usuario reclamante
    if (action === 'approve' && claim.targetType === 'token') {
      try {
        await db.token.update({ where: { id: claim.targetId }, data: { devId: claim.userId } })
      } catch {
        /* el token pudo ser borrado; no bloquea la aprobación */
      }
    }

    return NextResponse.json({ ok: true, claim: updated })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
