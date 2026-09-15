import { NextResponse } from 'next/server'
import { confirmSwapIntentEvm, InvalidConfirmEvmError, isEvmNetwork } from '@/lib/swap-evm'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

/**
 * POST /api/swap/confirm-evm — se llama después de que la wallet firmó y
 * mandó la transacción de compra en una red EVM. Verifica que de verdad
 * corrió en la red y, si quien la hizo fue invitado por alguien, le da
 * puntos a ese invitador.
 */
export async function POST(req: Request) {
  try {
    const limit = await rateLimit(`swap-confirm:${clientIp(req)}`, 20, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const intentId = typeof body.intentId === 'string' ? body.intentId.trim() : ''
    const network = typeof body.network === 'string' ? body.network.trim() : ''
    const txHash = typeof body.txHash === 'string' ? body.txHash.trim() : ''
    if (!isEvmNetwork(network)) return NextResponse.json({ error: 'Red no válida' }, { status: 400 })
    if (!intentId || !txHash) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const result = await confirmSwapIntentEvm({ intentId, network, txHash })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof InvalidConfirmEvmError) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[swap/confirm-evm]', e)
    return NextResponse.json({ error: 'No se pudo confirmar la operación' }, { status: 502 })
  }
}
