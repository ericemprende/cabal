import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDonateCard } from '@/lib/donate-card'
import { toLocale } from '@/lib/share-card'

/**
 * GET /api/donate/card/<handle>.<idioma>.jpg
 * Imagen Open Graph del enlace de la donación (/d/<handle>): la tarjeta de "yo
 * sostengo a @Cabal_app" con el avatar y el @usuario de quien la publica. La
 * pide el rastreador de X cuando alguien comparte su post.
 */
export async function GET(req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await ctx.params
  const match = /^@*(\w{1,20})(?:\.(es|en))?\.(?:jpe?g|png)$/i.exec(raw)
  if (!match) {
    return NextResponse.json({ error: 'Handle inválido' }, { status: 400 })
  }
  const handle = match[1]
  // El idioma viaja en la URL: el rastreador de X pide esta imagen desde sus
  // propios servidores, así que aquí no hay cabecera de idioma que valga.
  const locale = toLocale(match[2] ?? new URL(req.url).searchParams.get('l'))

  // El avatar sale de la cuenta Cabal; si el enlace es de alguien que solo está
  // en la lista de espera, de su entrada. Sin ninguno, la silueta por defecto.
  const user = await db.user
    .findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { handle: true, avatar: true },
    })
    .catch(() => null)
  const entry = user
    ? null
    : await db.waitlistEntry
        .findFirst({
          where: { xHandle: { equals: handle, mode: 'insensitive' } },
          select: { xHandle: true, xAvatar: true },
        })
        .catch(() => null)

  const image = await getDonateCard({
    handle: user?.handle ?? entry?.xHandle ?? handle,
    avatarUrl: user?.avatar ?? entry?.xAvatar ?? null,
    locale,
  })

  return new NextResponse(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Sin Content-Length, Next la manda con Transfer-Encoding: chunked, y el
      // rastreador de X es más estricto que un navegador (ver las otras dos
      // tarjetas): conviene declarar el tamaño exacto.
      'Content-Length': String(image.byteLength),
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
