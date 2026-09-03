import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const MAX_BYTES = 2.5 * 1024 * 1024 // 2.5 MB

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
    }
    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'Formato no permitido. Usa PNG, JPG, WebP o GIF.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'La imagen pesa más de 2.5 MB' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const dir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(dir, { recursive: true })
    const name = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${ext}`
    await writeFile(path.join(dir, name), buffer)
    return NextResponse.json({ ok: true, url: `/uploads/${name}` }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
