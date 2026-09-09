import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'

/** Escapa un campo para CSV (RFC 4180): comillas dobles duplicadas. */
function csv(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

/** GET /api/admin/waitlist/export — descarga la lista completa en CSV. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const all = new URL(req.url).searchParams.get('all') === '1'
    const entries = await db.waitlistEntry.findMany({
      where: all ? {} : { completed: true },
      orderBy: { createdAt: 'asc' },
    })
    const header = [
      'posicion',
      'handle',
      'nombre',
      'email',
      'telegram',
      'wallet',
      'pais',
      'motivo',
      'x_id',
      'seguidores',
      'x_verificado',
      'cuenta_x_creada',
      'estado',
      'compartio',
      'invitado_por',
      'nota',
      'registrado',
      'aprobado',
    ]
    const lines = entries.map((e, i) =>
      [
        i + 1,
        `@${e.xHandle}`,
        e.xName,
        e.email,
        e.telegram,
        e.wallet,
        e.country,
        e.reason,
        e.xId,
        e.xFollowers,
        e.xVerified ? 'si' : 'no',
        e.xCreatedAt?.toISOString() ?? '',
        e.status,
        e.shared ? 'si' : 'no',
        e.referredBy ?? '',
        e.note,
        e.createdAt.toISOString(),
        e.approvedAt?.toISOString() ?? '',
      ]
        .map(csv)
        .join(',')
    )
    // BOM para que Excel abra los acentos correctamente
    const body = '\uFEFF' + [header.join(','), ...lines].join('\r\n')
    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cabal-whitelist-${stamp}.csv"`,
      },
    })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
