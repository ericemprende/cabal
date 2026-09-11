import { NextResponse } from 'next/server'
import { getIpfsImage } from '@/lib/ipfs-cache'
import { isCid } from '@/lib/remote-image'

/**
 * GET /api/img/ipfs/<cid>
 * Copia local de una imagen de IPFS (logo o banner de un token), en WebP y
 * reducida. Ver lib/remote-image y lib/ipfs-cache.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const { cid } = await ctx.params
  if (!isCid(cid)) {
    return NextResponse.json({ error: 'CID inválido' }, { status: 400 })
  }

  const image = await getIpfsImage(cid)
  if (!image) {
    // Un 404, no un 500: el navegador dispara onError y la interfaz enseña su
    // alternativa. Caché corta, para reintentar pronto cuando las pasarelas
    // vuelvan a responder.
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=300' },
    })
  }

  return new NextResponse(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/webp',
      // El contenido de un CID no puede cambiar: se cachea para siempre
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
