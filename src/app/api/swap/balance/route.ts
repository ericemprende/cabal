import { NextResponse } from 'next/server'
import { tokenBalance } from '@/lib/swap'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

export async function GET(req: Request) {
  try {
    const limit = await rateLimit(`swap-balance:${clientIp(req)}`, 30, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const { searchParams } = new URL(req.url)
    const owner = searchParams.get('owner')?.trim() ?? ''
    const mint = searchParams.get('mint')?.trim() ?? ''
    if (!owner || !mint) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const balance = await tokenBalance({ owner, mint })
    return NextResponse.json(balance)
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar el saldo' }, { status: 502 })
  }
}
