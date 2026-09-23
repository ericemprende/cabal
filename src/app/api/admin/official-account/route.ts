import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { invalidate } from '@/lib/cache'
import { getOfficialAccount, setOfficialAccount } from '@/lib/official-account'

function fail(e: unknown) {
  if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
  return NextResponse.json({ error: (e as Error).message }, { status: 500 })
}

/** GET /api/admin/official-account — qué usuario es la cuenta oficial de Cabal. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    return NextResponse.json(await getOfficialAccount())
  } catch (e) {
    return fail(e)
  }
}

/** POST { handle } — esa cuenta pasa a ser la oficial (y absorbe la creada sola). */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    if (typeof body?.handle !== 'string' || !body.handle.trim()) {
      return NextResponse.json({ error: 'Indica el @usuario' }, { status: 400 })
    }
    const res = await setOfficialAccount(body.handle)
    // Los launches cambian de autor: el Radar y Tokens están cacheados
    await Promise.all([invalidate('launches:*'), invalidate('tokens:*')])
    return NextResponse.json(res)
  } catch (e) {
    return fail(e)
  }
}
