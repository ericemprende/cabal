import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, getPointRules, requireAdmin } from '@/lib/api-helpers'

export async function GET() {
  try {
    await requireAdmin()
    const rules = await getPointRules()
    return NextResponse.json(rules)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin()
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
