import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/pump/meta/<mint> — metadata del token en el formato que leen
 * pump.fun, las wallets y los exploradores. Es la `uri` grabada en el token
 * al crearlo desde /lanzar, así que no puede dejar de responder.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params
  const coin = await db.pumpCoin.findUnique({ where: { mint } })
  if (!coin) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(
    {
      name: coin.name,
      symbol: coin.symbol,
      description: coin.description,
      image: coin.image,
      showName: true,
      createdOn: 'https://cabal.army',
      ...(coin.twitter ? { twitter: coin.twitter } : {}),
      ...(coin.telegram ? { telegram: coin.telegram } : {}),
      ...(coin.website ? { website: coin.website } : {}),
    },
    { headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } },
  )
}
