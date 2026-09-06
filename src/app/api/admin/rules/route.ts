import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, getPointRules, requireAdmin } from '@/lib/api-helpers'

// Defaults mostrados cuando la Setting aún no existe en la BD
const RULE_DEFAULTS: Record<string, number> = {
  points_referral_percent: 10,
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const rules = await getPointRules()
    return NextResponse.json({ ...RULE_DEFAULTS, ...rules })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = (await req.json()) as Record<string, number>
    const updates = Object.entries(body)
      .filter(([k, v]) => k.startsWith('points_') && Number.isFinite(v) && v >= 0 && v <= 10000)
      .map(([k, v]) =>
        db.setting.upsert({
          where: { key: k },
          update: { value: String(Math.round(v)) },
          create: { key: k, value: String(Math.round(v)) },
        })
      )
    await db.$transaction(updates)
    const rules = await getPointRules()
    return NextResponse.json({ ok: true, rules })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
