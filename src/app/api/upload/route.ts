import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const MAX_BYTES = 5 * 1024 * 1024

/**
 * POST /api/upload — sube una imagen (logo o banner de un launch/token)
 * y devuelve { url: '/uploads/<archivo>' }. Guarda en public/uploads.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }
    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'Formato no soportado (usa PNG, JPG, WebP o GIF)' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'La imagen supera los 5MB' }, { status: 400 })
    }
    const name = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`
    const dir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ url: `/uploads/${name}` })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
