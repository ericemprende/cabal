import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, getPointRules, requireAdmin } from '@/lib/api-helpers'
import { followDeadline } from '@/lib/follow-x'

// Defaults mostrados cuando la Setting aún no existe en la BD
const RULE_DEFAULTS: Record<string, number> = {
  points_referral_percent: 10,
  points_swap_referral_pct: 25,
  points_per_usd_fee: 100,
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const rules = await getPointRules()
    // El cierre de la campaña de X no es un número de puntos, pero se edita en
    // la misma pantalla, así que viaja con las reglas: yyyy-mm-dd, que es lo
    // que entiende un <input type="date">.
    const deadline = await followDeadline()
    return NextResponse.json({
      ...RULE_DEFAULTS,
      ...rules,
      follow_x_deadline: deadline.toISOString().slice(0, 10),
    })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = (await req.json()) as Record<string, number | string>
    const updates = Object.entries(body)
      .filter(
        ([k, v]) =>
          k.startsWith('points_') && typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10000
      )
      .map(([k, v]) =>
        db.setting.upsert({
          where: { key: k },
          update: { value: String(Math.round(v as number)) },
          create: { key: k, value: String(Math.round(v as number)) },
        })
      )

    // Cierre de la campaña de X: llega como yyyy-mm-dd y se guarda con la hora
    // al final del día en UTC, que es como lo lee followDeadline(). Una fecha
    // ilegible se ignora en vez de dejar la Setting en un valor que rompa la
    // campaña entera.
    const raw = body.follow_x_deadline
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const value = new Date(`${raw}T23:59:59.999Z`)
      if (!Number.isNaN(value.getTime())) {
        updates.push(
          db.setting.upsert({
            where: { key: 'follow_x_deadline' },
            update: { value: value.toISOString() },
            create: { key: 'follow_x_deadline', value: value.toISOString() },
          })
        )
      }
    }

    await db.$transaction(updates)
    const rules = await getPointRules()
    return NextResponse.json({ ok: true, rules })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
