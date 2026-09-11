import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { grantDays } from '@/lib/premium'

/**
 * POST /api/admin/premium/grant — { handle, days: número | null, note? }
 * Regala acceso premium (colaboradores, pruebas, compensaciones). days = null
 * lo da sin fecha de caducidad.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const handle = String(body.handle ?? '').trim().replace(/^@+/, '').toLowerCase()
    if (!handle) return NextResponse.json({ error: 'Indica el @usuario' }, { status: 400 })
    const days = body.days === null ? null : Math.round(Number(body.days))
    if (days !== null && !(Number.isFinite(days) && days >= 1 && days <= 3650)) {
      return NextResponse.json({ error: 'Duración no válida (1 a 3650 días)' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { handle }, select: { id: true } })
    if (!user) return NextResponse.json({ error: `No existe @${handle}` }, { status: 404 })

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : ''
    const sub = await grantDays(user.id, days, { provider: 'admin', plan: 'custom', note })
    return NextResponse.json({ ok: true, id: sub.id, until: sub.currentPeriodEnd?.toISOString() ?? null })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/premium/grant?id= — retira un acceso regalado o pagado en
 * cripto. Las suscripciones de Stripe se cancelan en Stripe: si se cortaran solo
 * aquí, Stripe seguiría cobrando.
 */
export async function DELETE(req: Request) {
  try {
    await requireAdmin(req)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const sub = await db.subscription.findUnique({ where: { id } })
    if (!sub) return NextResponse.json({ error: 'Acceso no encontrado' }, { status: 404 })
    if (sub.provider === 'stripe') {
      return NextResponse.json(
        { error: 'Las suscripciones con tarjeta se cancelan desde el panel de Stripe' },
        { status: 400 }
      )
    }
    await db.subscription.update({ where: { id }, data: { status: 'canceled' } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
