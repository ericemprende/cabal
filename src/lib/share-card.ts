import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Tarjeta personalizada que acompaña al post de la lista de espera en X.
 *
 * X no permite adjuntar una imagen desde un intent de publicación, así que la
 * imagen viaja como tarjeta Open Graph del enlace de referido: el post lleva
 * cabal.army/?ref=<handle> y esta ruta genera el `og:image` de ese enlace con
 * el @usuario y el avatar del que comparte incrustados en la plantilla.
 *
 * Las cinco plantillas traen una "píldora" vacía abajo a la izquierda; SLOTS
 * guarda sus coordenadas reales (medidas sobre el píxel, no a ojo) para cada
 * una, en el espacio de 1672x941 del original.
 */

export const CARD_W = 1672
export const CARD_H = 941

type Slot = {
  /** Píldora: borde exterior. */
  x: number
  y: number
  w: number
  h: number
  /** Círculo del avatar: cubre exactamente la silueta placeholder de la plantilla. */
  cx: number
  cy: number
  d: number
  /**
   * Parche opcional del color interior de la píldora, pintado antes del avatar.
   * Solo hace falta donde el placeholder no es redondo (hombros de la silueta)
   * y un círculo del alto de la píldora no llega a taparlo.
   */
  cover?: { x: number; y: number; w: number; h: number }
}

/** Interior de la píldora: prácticamente negro en las cinco plantillas. */
const PILL_INK = '#080d0c'

/**
 * Geometría de cada plantilla en el original de 1672x941. Los valores salen de
 * medir los píxeles de la píldora y del icono de silueta en cada imagen, no de
 * estimarlos: cada plantilla los coloca en un sitio ligeramente distinto y un
 * avatar mal dimensionado deja asomar el placeholder por debajo.
 */
const SLOTS: Slot[] = [
  // card-1: su silueta tiene hombros anchos, de ahí el parche
  { x: 75, y: 741, w: 435, h: 79, cx: 117, cy: 779, d: 75, cover: { x: 80, y: 746, w: 76, h: 66 } },
  { x: 64, y: 743, w: 377, h: 65, cx: 104, cy: 776, d: 50 }, // card-2
  { x: 101, y: 717, w: 416, h: 86, cx: 133, cy: 760, d: 56 }, // card-3
  { x: 100, y: 717, w: 418, h: 85, cx: 133, cy: 760, d: 56 }, // card-4
  { x: 100, y: 716, w: 418, h: 86, cx: 133, cy: 760, d: 56 }, // card-5
]

export const CARD_COUNT = SLOTS.length

/** Frases del post. Se elige una de forma estable por usuario. */
export const SHARE_PHRASES = [
  'Ya soy parte de Cabal.army 🐺 Radar activado: los memecoins se ven antes de que salgan.',
  'Me uní al escuadrón de Cabal.army 🐺 El radar donde la comunidad los ve venir.',
  'Radar activado. Ya estoy dentro de la lista de espera de Cabal.army 🐺',
  'Misión activada: soy parte de Cabal.army 🐺 Los launches, antes que nadie.',
  'En la frecuencia de Cabal.army 🐺 Me apunté a la lista de espera.',
]

/**
 * Índice estable (0..n-1) derivado del identificador del usuario: cada persona
 * recibe siempre la misma plantilla y frase, pero repartidas entre todas.
 */
export function pickIndex(seed: string, n: number): number {
  const hash = createHash('sha256').update(seed).digest()
  return hash.readUInt32BE(0) % n
}

/** Escapa el texto que se inyecta en el SVG de la tarjeta. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function fetchAvatar(url: string | null): Promise<Buffer | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Compone la tarjeta: plantilla + avatar circular + @usuario dentro de la
 * píldora. Devuelve un PNG listo para servir.
 */
export async function renderShareCard(opts: {
  handle: string
  avatarUrl?: string | null
  seed?: string
}): Promise<Buffer> {
  const seed = opts.seed || opts.handle
  const idx = pickIndex(seed, CARD_COUNT)
  const slot = SLOTS[idx]
  const template = path.join(process.cwd(), 'public', 'share', `card-${idx + 1}.png`)

  const size = slot.d
  const avatarX = Math.round(slot.cx - size / 2)
  const avatarY = Math.round(slot.cy - size / 2)

  const layers: sharp.OverlayOptions[] = []

  if (slot.cover) {
    const c = slot.cover
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${c.w}" height="${c.h}"><rect width="${c.w}" height="${c.h}" fill="${PILL_INK}"/></svg>`
      ),
      left: c.x,
      top: c.y,
    })
  }

  const raw = await fetchAvatar(opts.avatarUrl ?? null)
  if (raw) {
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    )
    try {
      const avatar = await sharp(raw)
        .resize(size, size, { fit: 'cover' })
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toBuffer()
      layers.push({ input: avatar, left: avatarX, top: avatarY })
    } catch {
      // Avatar ilegible: la tarjeta sale con el icono por defecto de la plantilla
    }
  }

  // @usuario a la derecha del avatar, centrado verticalmente en la píldora.
  // El SVG cubre solo la píldora y se pega en su posición: sharp exige que las
  // capas no superen el lienzo, y así el texto no depende del tamaño del fondo.
  const textLeft = avatarX + size + Math.round(slot.h * 0.26) - slot.x
  const fontSize = Math.round(slot.h * 0.46)
  const baseline = slot.h / 2 + fontSize * 0.36
  // Ancho libre hasta el borde derecho de la píldora (0.58em ≈ ancho medio)
  const maxChars = Math.floor((slot.w - textLeft - Math.round(slot.h * 0.18)) / (fontSize * 0.58))
  const handle = `@${opts.handle}`
  const shown = handle.length > maxChars ? `${handle.slice(0, Math.max(3, maxChars - 1))}…` : handle

  layers.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${slot.w}" height="${slot.h}">
        <text x="${textLeft}" y="${baseline}" font-family="Arial, Helvetica, sans-serif"
              font-size="${fontSize}" font-weight="bold" fill="#dff0b0"
              letter-spacing="1">${esc(shown)}</text>
      </svg>`
    ),
    left: slot.x,
    top: slot.y,
  })

  return sharp(template).composite(layers).png({ quality: 90 }).toBuffer()
}

/**
 * Igual que renderShareCard pero cacheando en disco: el rastreador de X pide la
 * imagen varias veces y no conviene recomponerla en cada visita.
 */
export async function getShareCard(opts: {
  handle: string
  avatarUrl?: string | null
  seed?: string
}): Promise<Buffer> {
  const key = createHash('sha256')
    .update(`${opts.seed ?? ''}|${opts.handle}|${opts.avatarUrl ?? ''}`)
    .digest('hex')
    .slice(0, 24)
  const dir = path.join(process.cwd(), 'upload', 'cards')
  const file = path.join(dir, `${key}.png`)

  try {
    return await readFile(file)
  } catch {
    // Todavía no está cacheada
  }

  const png = await renderShareCard(opts)
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(file, png)
  } catch {
    // Sin permisos de escritura seguimos sirviendo la imagen en memoria
  }
  return png
}
