import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

/**
 * Imágenes que suben los usuarios (logo y banner de un launch, foto de perfil).
 *
 * Se guardan en upload/uploads, dentro del volumen persistente de /app/upload,
 * y no en public/: el servidor standalone de Next solo sirve lo que había en
 * public/ al compilar, y además public/ se rehace en cada despliegue. Las sirve
 * GET /uploads/<nombre> (src/app/uploads/[name]/route.ts), así las URLs
 * /uploads/… que ya aceptan el perfil y los launches siguen valiendo.
 *
 * Todo pasa por sharp y sale en WebP: quita los metadatos (la ubicación GPS de
 * una foto del móvil, por ejemplo) y descarta cualquier archivo que no sea de
 * verdad una imagen, diga lo que diga su tipo MIME.
 */

const DIR = path.join(process.cwd(), 'upload', 'uploads')

/** Máximo que se acepta (el navegador ya reduce las fotos antes de subirlas). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
/** Lado máximo guardado: da para un banner a pantalla completa. */
const MAX_SIDE = 1500
/** Formatos de entrada admitidos. */
export const UPLOAD_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])

/** Nombre de archivo que genera saveUpload: nada de rutas ni extensiones raras. */
const NAME_RE = /^[a-z0-9]{6,14}-[a-f0-9]{8}\.webp$/

export class InvalidImageError extends Error {}

/** Convierte y guarda la imagen. Devuelve la URL pública (/uploads/<nombre>). */
export async function saveUpload(input: Buffer): Promise<string> {
  let webp: Buffer
  try {
    // animated: conserva la animación de los GIF. rotate(): respeta la
    // orientación EXIF antes de tirar los metadatos.
    webp = await sharp(input, { animated: true, limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    throw new InvalidImageError('El archivo no es una imagen válida')
  }
  const name = `${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}.webp`
  await mkdir(DIR, { recursive: true })
  await writeFile(path.join(DIR, name), webp)
  return `/uploads/${name}`
}

/** Lee una imagen subida; null si el nombre no es válido o no existe. */
export async function readUpload(name: string): Promise<Buffer | null> {
  if (!NAME_RE.test(name)) return null
  try {
    return await readFile(path.join(DIR, name))
  } catch {
    return null
  }
}
