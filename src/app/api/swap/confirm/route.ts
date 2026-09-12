import { NextResponse } from 'next/server'
import { confirmSwapIntent, InvalidConfirmError } from '@/lib/swap'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

/**
 * POST /api/swap/confirm — se llama después de que la wallet firmó y mandó la
 * transacción de compra/venta. Verifica que de verdad corrió en la red y, si
 * quien la hizo fue invitado por alguien, le da puntos a ese invitador.
 */
export async function POST(req: Request) {
  try {
    const limit = await rateLimit(`swap-confirm:${clientIp(req)}`, 20, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const intentId = typeof body.intentId === 'string' ? body.intentId.trim() : ''
    const signature = typeof body.signature === 'string' ? body.signature.trim() : ''
    if (!intentId || !signature) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const result = await confirmSwapIntent({ intentId, signature })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof InvalidConfirmError) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[swap/confirm]', e)
    return NextResponse.json({ error: 'No se pudo confirmar la operación' }, { status: 502 })
  }
}
