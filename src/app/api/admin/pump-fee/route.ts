import { NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { LAUNCH_FEE_PLATFORMS, PUMP_FEE_KEYS, launchFeeKey, launchFeeSettings } from '@/lib/pump-launch'

/**
 * GET /api/admin/pump-fee — comisión por lanzamiento de cada launchpad y la
 * wallet que la cobra ({ wallet, fees: { pump, bonk, cabal } }).
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    return NextResponse.json(await launchFeeSettings())
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** PUT /api/admin/pump-fee — body { wallet, fees: { pump, bonk, cabal } }. 0 = gratis. */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as { wallet?: unknown; fees?: Record<string, unknown> }
    const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
    try {
      new PublicKey(wallet)
    } catch {
      return NextResponse.json({ error: 'La wallet de Solana no es válida' }, { status: 400 })
    }
    const writes = [
      db.setting.upsert({ where: { key: PUMP_FEE_KEYS.wallet }, create: { key: PUMP_FEE_KEYS.wallet, value: wallet }, update: { value: wallet } }),
    ]
    for (const p of LAUNCH_FEE_PLATFORMS) {
      const sol = Number(body.fees?.[p])
      if (!Number.isFinite(sol) || sol < 0 || sol > 10) {
        return NextResponse.json({ error: 'Cada comisión tiene que estar entre 0 y 10 SOL' }, { status: 400 })
      }
      const key = launchFeeKey(p)
      writes.push(db.setting.upsert({ where: { key }, create: { key, value: String(sol) }, update: { value: String(sol) } }))
    }
    await db.$transaction(writes)
    return NextResponse.json(await launchFeeSettings())
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
