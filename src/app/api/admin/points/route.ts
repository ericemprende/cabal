import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'

export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json()
    const { userId, amount, note, reason } = body
    const amt = parseInt(String(amount), 10)
    if (!userId || isNaN(amt) || amt === 0) {
      return NextResponse.json({ error: 'Usuario y monto (≠ 0) requeridos' }, { status: 400 })
    }
    const target = await db.user.findUnique({ where: { id: userId } })
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    if (target.points + amt < 0) {
      return NextResponse.json({ error: 'El balance no puede quedar negativo' }, { status: 400 })
    }
    await db.$transaction([
      db.pointEvent.create({
        data: {
          userId,
          amount: amt,
          reason: amt > 0 ? 'admin_adjust' : 'redeem',
          note: note || (amt > 0 ? 'Ajuste manual del admin' : 'Canje de puntos'),
        },
      }),
      db.user.update({
        where: { id: userId },
        data: { points: { increment: amt } },
      }),
    ])
    const updated = await db.user.findUnique({ where: { id: userId } })
    return NextResponse.json({ ok: true, points: updated?.points ?? 0 })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
