import { NextResponse } from 'next/server'
import { callCardDataFor, renderCallCard } from '@/lib/call-card'

/**
 * GET /api/posts/<id>/card — tarjeta de evidencia de una call, para descargar
 * desde el dashboard. El precio actual cambia, así que no se cachea en disco
 * (a diferencia de la tarjeta de invitación): cada descarga se compone al
 * vuelo con el mercado del momento.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const data = await callCardDataFor(id)
  if (!data) {
    return NextResponse.json({ error: 'Esta call no tiene evidencia para generar una tarjeta' }, { status: 404 })
  }

  const png = await renderCallCard(data)
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="cabal-call-${id}.png"`,
      'Cache-Control': 'no-store',
    },
  })
}
