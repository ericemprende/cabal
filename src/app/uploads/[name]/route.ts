import { NextResponse } from 'next/server'
import { readUpload } from '@/lib/uploads'

export const runtime = 'nodejs'

/** GET /uploads/<nombre> — sirve una imagen subida por un usuario (ver lib/uploads). */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params
  const image = await readUpload(name)
  if (!image) {
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } })
  }
  return new NextResponse(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/webp',
      // Cada subida tiene un nombre nuevo: su contenido no cambia nunca
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
