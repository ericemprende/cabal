import { NextResponse } from 'next/server'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { InvalidImageError, MAX_UPLOAD_BYTES, UPLOAD_TYPES, saveUpload } from '@/lib/uploads'

export const runtime = 'nodejs'

/**
 * POST /api/upload — multipart con el campo `file`. Devuelve { url }.
 * Solo con sesión real: sin ella cualquiera podría llenar el disco del servidor.
 */
export async function POST(req: Request) {
  const userId = await sessionUserIdFromCookies()
  if (!userId) {
    return NextResponse.json({ error: 'Inicia sesión para subir imágenes' }, { status: 401 })
  }
  const limit = await rateLimit(`upload:${userId}`, 20, 600)
  if (!limit.ok) return tooManyRequests(limit)

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    // Algunos móviles mandan el archivo sin tipo MIME o en HEIC: se dejan pasar
    // y sharp decide si es una imagen de verdad (InvalidImageError si no).
    if (file.type && !UPLOAD_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Formato no permitido. Usa PNG, JPG, WebP o GIF (o pega la URL de la imagen).' },
        { status: 400 }
      )
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'La imagen supera el máximo de 8 MB. Reduce el tamaño o pega la URL.' },
        { status: 400 }
      )
    }
    const url = await saveUpload(Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ ok: true, url }, { status: 201 })
  } catch (e) {
    if (e instanceof InvalidImageError) {
      return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
    }
    console.error('[upload]', e)
    return NextResponse.json(
      { error: 'No se pudo guardar la imagen. Intenta pegando la URL directamente.' },
      { status: 500 }
    )
  }
}
