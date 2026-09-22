import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { CABAL_X_HANDLE } from '@/lib/cabal-x'
import { CARD_H, CARD_W, toLocale, type Locale } from '@/lib/share-card'

/**
 * Tarjeta de "he donado a Cabal": el og:image de /d/<handle>.
 *
 * Mismo problema y misma solución que las otras dos tarjetas (ver
 * share-card.ts): X no admite adjuntos en un intent de publicación, así que la
 * imagen viaja como tarjeta Open Graph del enlace que acompaña al post.
 *
 * El fondo se compone aquí con SVG, como en follow-card.ts, para no depender de
 * arte nuevo. Si algún día hay plantilla diseñada, basta con dejarla en
 * `public/share/donate/<idioma>.png` a 1672x941 y esta función la usa de fondo
 * sin tocar el código: el avatar y el @usuario se pintan encima igual.
 *
 * La tarjeta NO dice cuánto se donó: el importe es de cada uno, y lo que se
 * comparte es que sostiene el proyecto (ver DONATE_SHARE_TEXT).
 */

/**
 * Versión de la composición: forma parte de la clave de la caché en disco, así
 * que subirla invalida las tarjetas ya generadas. Hay que tocarla SIEMPRE que
 * cambie el aspecto; si no, el servidor sigue sirviendo las viejas.
 *   v1 → fondo generado con el corazón del radar, titular a dos líneas.
 */
const CARD_VERSION = 'donate-v1'

/** Igual que en las otras tarjetas: el contenedor solo trae Liberation Sans. */
const FONT_STACK = "'Liberation Sans', Arial, 'DejaVu Sans', Helvetica, sans-serif"

const INK = '#eaf5d2'
const GREEN = '#b6e04b'
const MUTED = '#9bad72'

/**
 * Avatar y @usuario en el espacio de 1672x941 del original, en la misma banda
 * segura que la tarjeta de seguir: X recorta la imagen a 1.91:1 y le pone
 * encima, abajo a la izquierda, la caja del título, así que nada baja de y=732.
 */
const AVATAR = { x: 86, y: 600, d: 132, ring: 5, font: 50 }
const HANDLE = { gap: 30, maxRight: 900 }

/** Titular del fondo generado, a dos líneas: librsvg no ajusta texto solo. */
const HEADLINE: Record<Locale, [string, string]> = {
  es: ['YO SOSTENGO', `@${CABAL_X_HANDLE}`],
  en: ['I SUPPORT', `@${CABAL_X_HANDLE}`],
}

const SUBTITLE: Record<Locale, string> = {
  es: 'Donación voluntaria al radar que la comunidad mantiene en pie.',
  en: 'A voluntary donation to the radar the community keeps alive.',
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Corazón: dos arcos y la punta, dibujado en una caja de 100x100 que luego se
 * escala. Es el único adorno del fondo y ata la tarjeta al botón de donar, que
 * lleva el mismo icono.
 */
function heart(cx: number, cy: number, size: number, opacity: number): string {
  const s = size / 100
  return `<g transform="translate(${cx} ${cy}) scale(${s.toFixed(3)}) translate(-50 -46)" opacity="${opacity}">
    <path d="M50 88 L8 42 A24 24 0 0 1 50 14 A24 24 0 0 1 92 42 Z" fill="${GREEN}"/>
  </g>`
}

/**
 * Fondo generado: degradado oscuro, ecos de radar a la derecha con un corazón
 * en el centro y el titular a la izquierda. Todo por encima de y=640, que es
 * donde entra el avatar.
 */
function background(locale: Locale): Buffer {
  const [l1, l2] = HEADLINE[locale]
  // Centro del radar fuera del borde derecho: se ven los arcos, no el círculo
  // entero, y el titular queda sobre fondo limpio.
  const cx = 1430
  const cy = 420
  const rings = [140, 250, 360, 470, 580]
    .map(
      (r, i) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GREEN}" stroke-width="2" opacity="${(0.22 - i * 0.03).toFixed(2)}"/>`
    )
    .join('')

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#101403"/>
          <stop offset="55%" stop-color="#0d0f0a"/>
          <stop offset="100%" stop-color="#161c0b"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.85" cy="0.42" r="0.55">
          <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)"/>
      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#glow)"/>
      ${rings}
      ${heart(cx, cy, 190, 0.9)}
      ${heart(cx - 330, cy - 210, 64, 0.45)}
      ${heart(cx - 180, cy + 260, 44, 0.3)}

      <text x="86" y="300" font-family="${FONT_STACK}" font-size="104" font-weight="bold"
            fill="${INK}" letter-spacing="2">${esc(l1)}</text>
      <text x="86" y="420" font-family="${FONT_STACK}" font-size="104" font-weight="bold"
            fill="${GREEN}" letter-spacing="2">${esc(l2)}</text>
      <rect x="86" y="470" width="120" height="6" fill="${GREEN}" opacity="0.85"/>
      <text x="86" y="560" font-family="${FONT_STACK}" font-size="38"
            fill="${MUTED}">${esc(SUBTITLE[locale])}</text>
    </svg>`
  )
}

/** Silueta por defecto cuando no hay avatar o falla la descarga. */
function placeholderAvatar(size: number): Buffer {
  const r = size / 2
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${r}" cy="${r}" r="${r}" fill="#16200f"/>
      <circle cx="${r}" cy="${r * 0.78}" r="${r * 0.3}" fill="${GREEN}"/>
      <path d="M ${r * 0.3} ${size} a ${r * 0.7} ${r * 0.62} 0 0 1 ${r * 1.4} 0 Z" fill="${GREEN}"/>
    </svg>`
  )
}

async function fetchAvatar(url: string | null): Promise<Buffer | null> {
  if (!url) return null
  try {
    // X sirve el avatar a 48px; pedimos el original, que da resolución de sobra.
    const big = url.replace(/_(normal|bigger|mini)\.(jpg|jpeg|png|webp|gif)$/i, '.$2')
    const res = await fetch(big, { signal: AbortSignal.timeout(5000) })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    const fallback = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return fallback.ok ? Buffer.from(await fallback.arrayBuffer()) : null
  } catch {
    return null
  }
}

/** Plantilla diseñada si alguien la dejó en public/share/donate; si no, el fondo generado. */
async function base(locale: Locale): Promise<Buffer> {
  const custom = path.join(process.cwd(), 'public', 'share', 'donate', `${locale}.png`)
  try {
    return await readFile(custom)
  } catch {
    return background(locale)
  }
}

/** Compone la tarjeta y la devuelve como JPEG listo para servir. */
export async function renderDonateCard(opts: {
  handle: string
  avatarUrl?: string | null
  locale?: Locale
}): Promise<Buffer> {
  const locale = toLocale(opts.locale)
  const { x, y, d, ring, font } = AVATAR
  const layers: sharp.OverlayOptions[] = []

  // Aro exterior: un círculo lleno detrás del avatar, que solo asoma por fuera.
  const ringD = d + ring * 2
  layers.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ringD}" height="${ringD}">
        <circle cx="${ringD / 2}" cy="${ringD / 2}" r="${ringD / 2}" fill="${GREEN}"/>
      </svg>`
    ),
    left: x - ring,
    top: y - ring,
  })

  const raw = await fetchAvatar(opts.avatarUrl ?? null)
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`
  )
  let avatar: Buffer | null = null
  if (raw) {
    try {
      avatar = await sharp(raw)
        .resize(d, d, { fit: 'cover' })
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toBuffer()
    } catch {
      avatar = null // Avatar ilegible: cae en la silueta por defecto
    }
  }
  if (!avatar) avatar = await sharp(placeholderAvatar(d)).png().toBuffer()
  layers.push({ input: avatar, left: x, top: y })

  // @usuario centrado con el avatar, recortado antes de invadir el radar.
  const textX = x + d + HANDLE.gap
  const svgW = HANDLE.maxRight - textX
  const svgH = font * 2
  const handle = `@${opts.handle}`
  // 0.60em es el ancho medio de esta tipografía en negrita.
  const maxChars = Math.floor(svgW / (font * 0.6))
  const shown = handle.length > maxChars ? `${handle.slice(0, Math.max(3, maxChars - 1))}…` : handle
  layers.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
        <text x="0" y="${svgH / 2 + font * 0.36}"
              font-family="${FONT_STACK}" font-size="${font}"
              font-weight="bold" fill="${INK}" letter-spacing="1"
              stroke="#000000" stroke-width="6" stroke-opacity="0.45"
              paint-order="stroke">${esc(shown)}</text>
      </svg>`
    ),
    left: textX,
    top: Math.round(y + d / 2 - svgH / 2),
  })

  // JPEG y no PNG por lo mismo que en share-card.ts: codificar en PNG costaba
  // ~1.8s y el rastreador de X abandonaba la descarga antes de terminar.
  return sharp(await base(locale))
    .composite(layers)
    .jpeg({ quality: 84, chromaSubsampling: '4:4:4' })
    .toBuffer()
}

/**
 * Igual que renderDonateCard pero cacheando en disco: el rastreador de X pide
 * la imagen varias veces y no conviene recomponerla en cada visita.
 */
export async function getDonateCard(opts: {
  handle: string
  avatarUrl?: string | null
  locale?: Locale
}): Promise<Buffer> {
  const locale = toLocale(opts.locale)
  const key = createHash('sha256')
    .update(`${CARD_VERSION}|${opts.handle}|${opts.avatarUrl ?? ''}|${locale}`)
    .digest('hex')
    .slice(0, 24)
  const dir = path.join(process.cwd(), 'upload', 'cards')
  const file = path.join(dir, `${key}.jpg`)

  try {
    return await readFile(file)
  } catch {
    // Todavía no está cacheada
  }

  const jpeg = await renderDonateCard({ ...opts, locale })
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(file, jpeg)
  } catch {
    // Sin permisos de escritura seguimos sirviendo la imagen en memoria
  }
  return jpeg
}
