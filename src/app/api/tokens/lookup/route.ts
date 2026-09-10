import { NextRequest, NextResponse } from 'next/server'
import { fetchTokenMeta } from '@/lib/chain-stats'

/**
 * GET /api/tokens/lookup?ca=...
 * Ficha pública de un token por su CA (DexScreener → pump.fun) para
 * autocompletar el formulario de publicar lanzamiento.
 */
export async function GET(req: NextRequest) {
  const ca = req.nextUrl.searchParams.get('ca')?.trim() ?? ''
  if (!/^[a-zA-Z0-9]{32,44}$|^0x[a-fA-F0-9]{40}$/.test(ca)) {
    return NextResponse.json({ error: 'CA inválido' }, { status: 400 })
  }
  // Sin caché: un token recién desplegado debe aparecer en cuanto cotice
  return NextResponse.json(await fetchTokenMeta(ca))
}
