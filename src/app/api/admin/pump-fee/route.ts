import { NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { PUMP_FEE_KEYS, pumpLaunchFee } from '@/lib/pump-launch'

/** GET /api/admin/pump-fee — comisión por lanzamiento en pump.fun ({ sol, wallet }). */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    return NextResponse.json(await pumpLaunchFee())
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** PUT /api/admin/pump-fee — body { sol, wallet }. sol = 0 lanza gratis. */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as { sol?: unknown; wallet?: unknown }
    const sol = Number(body.sol)
    if (!Number.isFinite(sol) || sol < 0 || sol > 10) {
      return NextResponse.json({ error: 'La comisión tiene que estar entre 0 y 10 SOL' }, { status: 400 })
    }
    const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
    try {
      new PublicKey(wallet)
    } catch {
      return NextResponse.json({ error: 'La wallet de Solana no es válida' }, { status: 400 })
    }
    await db.$transaction([
      db.setting.upsert({ where: { key: PUMP_FEE_KEYS.sol }, create: { key: PUMP_FEE_KEYS.sol, value: String(sol) }, update: { value: String(sol) } }),
      db.setting.upsert({ where: { key: PUMP_FEE_KEYS.wallet }, create: { key: PUMP_FEE_KEYS.wallet, value: wallet }, update: { value: wallet } }),
    ])
    return NextResponse.json(await pumpLaunchFee())
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
