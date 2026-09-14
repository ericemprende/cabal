import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShareCard, toLocale } from '@/lib/share-card'

/**
 * GET /api/waitlist/card/<handle>.<idioma>.jpg
 * Imagen Open Graph del enlace de referido: la plantilla de Cabal.army con el
 * @usuario y el avatar de quien comparte. La consume el rastreador de X cuando
 * alguien publica su invitación (cabal.army/r/<handle>).
 */
export async function GET(req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await ctx.params
  // Formato actual: <handle>.<idioma>.jpg. Se aceptan también <handle>.jpg y
  // <handle>.png con ?l=<idioma>, que son los formatos de enlaces ya publicados.
  const match = /^@*(\w{1,15})(?:\.(es|en))?\.(?:jpe?g|png)$/i.exec(raw)
  if (!match) {
    return NextResponse.json({ error: 'Handle inválido' }, { status: 400 })
  }
  const handle = match[1]
  // El idioma viaja en la URL: el rastreador de X pide esta imagen desde sus
  // propios servidores, así que no se puede detectar aquí.
  const locale = toLocale(match[2] ?? new URL(req.url).searchParams.get('l'))

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
      // Sin esto Next la manda con Transfer-Encoding: chunked (tamaño
      // desconocido de antemano). El rastreador de X es más estricto que un
      // navegador con las imágenes que descarga: declarar el tamaño exacto
      // evita que dependa de leer el cuerpo entero para saber cuándo termina.
      'Content-Length': String(image.byteLength),
      // Inmutable en la práctica: la tarjeta solo cambia si cambia el avatar
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
