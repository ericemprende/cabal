import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShareCard } from '@/lib/share-card'

/**
 * GET /api/waitlist/card/<handle>.png
 * Imagen Open Graph del enlace de referido: la plantilla de Cabal.army con el
 * @usuario y el avatar de quien comparte. La consume el rastreador de X cuando
 * alguien publica cabal.army/?ref=<handle>.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await ctx.params
  const handle = raw.replace(/\.png$/i, '').replace(/^@+/, '')
  if (!/^[\w]{1,15}$/.test(handle)) {
    return NextResponse.json({ error: 'Handle inválido' }, { status: 400 })
  }

  // El avatar sale de la entrada de la lista; si no está, la plantilla se sirve
  // igualmente con su icono por defecto.
  const entry = await db.waitlistEntry
    .findFirst({
      where: { xHandle: { equals: handle, mode: 'insensitive' } },
      select: { xId: true, xHandle: true, xAvatar: true },
    })
    .catch(() => null)

  const png = await getShareCard({
    handle: entry?.xHandle ?? handle,
    avatarUrl: entry?.xAvatar ?? null,
    seed: entry?.xId ?? handle,
  })

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      // Inmutable en la práctica: la tarjeta solo cambia si cambia el avatar
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
