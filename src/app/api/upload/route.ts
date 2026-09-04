import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/api-helpers'

export const runtime = 'nodejs'

/** Extensiones permitidas por MIME type. */
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Máximo 2.5 MB (coincide con el hint de la UI). */
const MAX_BYTES = 2.5 * 1024 * 1024

export async function POST(req: Request) {
  try {
    await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'Inicia sesión para subir imágenes' }, { status: 401 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Formato no permitido. Usa PNG, JPG, WebP o GIF (o pega la URL de la imagen).' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'La imagen supera el máximo de 2.5 MB. Reduce el tamaño o pega la URL.' },
        { status: 400 }
      )
    }

    const dir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(dir, { recursive: true })
    const name = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(dir, name), buffer)

    return NextResponse.json({ ok: true, url: `/uploads/${name}` }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo guardar la imagen. Intenta pegando la URL directamente.' },
      { status: 500 }
    )
  }
}
