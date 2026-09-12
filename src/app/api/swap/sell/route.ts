import { NextResponse } from 'next/server'
import { buildSellTransactions, InvalidSellError } from '@/lib/swap'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

export async function POST(req: Request) {
  try {
    const limit = await rateLimit(`swap:${clientIp(req)}`, 20, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const inputMint = typeof body.inputMint === 'string' ? body.inputMint.trim() : ''
    const percent = Number(body.percent)
    const userPublicKey = typeof body.userPublicKey === 'string' ? body.userPublicKey.trim() : ''
    if (!inputMint || !userPublicKey || !Number.isFinite(percent)) {
      return NextResponse.json({ error: 'Faltan datos de la venta' }, { status: 400 })
    }

    const result = await buildSellTransactions({ inputMint, percent, userPublicKey })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof InvalidSellError) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[swap/sell]', e)
    return NextResponse.json({ error: 'No se pudo preparar la venta. Inténtalo de nuevo.' }, { status: 502 })
  }
}
