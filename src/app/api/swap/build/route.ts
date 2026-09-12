import { NextResponse } from 'next/server'
import { buildBuyTransactions, InvalidBuyError } from '@/lib/swap'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

/**
 * POST /api/swap/build — cotiza y arma la(s) transacción(es) de una compra.
 * Body: { outputMint, amountUsd, userPublicKey }
 *
 * No firma ni manda nada: solo construye. Sin sesión de Cabal a propósito —
 * lo único que hace falta para comprar es una wallet, no una cuenta.
 */
export async function POST(req: Request) {
  try {
    const limit = await rateLimit(`swap:${clientIp(req)}`, 20, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const body = await req.json().catch(() => ({}))
    const outputMint = typeof body.outputMint === 'string' ? body.outputMint.trim() : ''
    const amountUsd = Number(body.amountUsd)
    const userPublicKey = typeof body.userPublicKey === 'string' ? body.userPublicKey.trim() : ''
    if (!outputMint || !userPublicKey || !Number.isFinite(amountUsd)) {
      return NextResponse.json({ error: 'Faltan datos de la compra' }, { status: 400 })
    }

    const result = await buildBuyTransactions({ outputMint, amountUsd, userPublicKey })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof InvalidBuyError) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[swap/build]', e)
    return NextResponse.json({ error: 'No se pudo preparar la compra. Inténtalo de nuevo.' }, { status: 502 })
  }
}
