import { NextResponse } from 'next/server'
import { buildBuyTransactionEvm, InvalidBuyEvmError, isEvmNetwork } from '@/lib/swap-evm'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

/**
 * POST /api/swap/build-evm — cotiza y arma la transacción de una compra en
 * una red EVM (Ethereum, Base, BNB Chain) vía 0x. Body: { network,
 * outputToken, amountUsd, userAddress }
 *
 * No firma ni manda nada: solo construye. Sin sesión de Cabal a propósito —
 * lo único que hace falta para comprar es una wallet, no una cuenta.
 */
export async function POST(req: Request) {
  try {
    const limit = await rateLimit(`swap:${clientIp(req)}`, 20, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const network = typeof body.network === 'string' ? body.network.trim() : ''
    const outputToken = typeof body.outputToken === 'string' ? body.outputToken.trim() : ''
    const amountUsd = Number(body.amountUsd)
    const userAddress = typeof body.userAddress === 'string' ? body.userAddress.trim() : ''
    if (!isEvmNetwork(network)) return NextResponse.json({ error: 'Red no válida' }, { status: 400 })
    if (!outputToken || !userAddress || !Number.isFinite(amountUsd)) {
      return NextResponse.json({ error: 'Faltan datos de la compra' }, { status: 400 })
    }

    const result = await buildBuyTransactionEvm({ network, outputToken, amountUsd, userAddress })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof InvalidBuyEvmError) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[swap/build-evm]', e)
    return NextResponse.json({ error: 'No se pudo preparar la compra. Inténtalo de nuevo.' }, { status: 502 })
  }
}
