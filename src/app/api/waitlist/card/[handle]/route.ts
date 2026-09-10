import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShareCard, toLocale } from '@/lib/share-card'

/**
 * GET /api/waitlist/card/<handle>.jpg
 * Imagen Open Graph del enlace de referido: la plantilla de Cabal.army con el
 * @usuario y el avatar de quien comparte. La consume el rastreador de X cuando
 * alguien publica cabal.army/?ref=<handle>.
 */
export async function GET(req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await ctx.params
  // Se acepta .png además de .jpg porque hay enlaces antiguos publicados en X
  // que apuntan a la extensión anterior; el contenido es el mismo.
  const handle = raw.replace(/\.(jpe?g|png)$/i, '').replace(/^@+/, '')
  // El idioma viaja en el enlace (?l=en): el rastreador de X pide esta imagen
  // desde sus propios servidores, así que no se puede detectar aquí.
  const locale = toLocale(new URL(req.url).searchParams.get('l'))
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

  const image = await getShareCard({
    handle: entry?.xHandle ?? handle,
    avatarUrl: entry?.xAvatar ?? null,
    seed: entry?.xId ?? handle,
    locale,
  })

  return new NextResponse(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Inmutable en la práctica: la tarjeta solo cambia si cambia el avatar
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
