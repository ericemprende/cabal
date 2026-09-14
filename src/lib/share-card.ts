import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Tarjeta personalizada que acompaña al post de la lista de espera en X.
 *
 * X no permite adjuntar una imagen desde un intent de publicación, así que la
 * imagen viaja como tarjeta Open Graph del enlace de referido: el post lleva
 * cabal.army/r/<handle> (o /r/<handle>/en) y esta ruta genera el `og:image` de ese
 * enlace con el avatar y el @usuario de quien comparte incrustados.
 *
 * Hay cinco escenas y cada una existe en español y en inglés (mismo índice =
 * misma ilustración, distinto titular). El avatar y el nombre van SIEMPRE en la
 * misma posición —abajo a la izquierda, sobre el degradado oscuro que todas las
 * plantillas comparten—, así que la composición no depende de la plantilla.
 */

export const CARD_W = 1672
export const CARD_H = 941

/** Idiomas soportados por la tarjeta y por el texto del post. */
export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'es'

/** Normaliza cualquier entrada (query string, cabecera) a un idioma válido. */
export function toLocale(value: unknown): Locale {
  const v = String(value ?? '').toLowerCase().slice(0, 2)
  return (LOCALES as readonly string[]).includes(v) ? (v as Locale) : DEFAULT_LOCALE
}

/** Número de escenas disponibles en cada idioma. */
export const CARD_COUNT = 5

/**
 * Versión de la composición. Forma parte de la clave de la caché en disco, así
 * que subirla invalida todas las tarjetas ya generadas. Hay que tocarla siempre
 * que cambie el aspecto (posición, tamaños, tipografía): si no, el servidor
 * seguiría sirviendo las imágenes viejas indefinidamente.
 *   v2 → avatar grande, posición fija y tipografía con fuentes del contenedor.
 *   v3 → bloque subido para que el título de X no lo tape.
 *   v4 → salida en JPEG, mucho más rápida de generar y de descargar.
 *   v5 → posición por escena, medida a 1px sobre cada plantilla.
 *   v6 → JPEG sin mozjpeg, 6 veces más rápido de codificar.
 *   v7 → avatar y @usuario bajados un poco en todas las escenas: quedaban
 *        demasiado pegados al subtítulo de la plantilla.
 */
const CARD_VERSION = 'v7'

/**
 * Tipografía del @usuario. Se listan varias a propósito: el contenedor de
 * producción lleva Liberation Sans (ver Dockerfile) y las máquinas de
 * desarrollo suelen tener Arial. Si no se resuelve ninguna, el texto se
 * compone vacío en vez de fallar, que es difícil de detectar.
 */
const FONT_STACK = "'Liberation Sans', Arial, 'DejaVu Sans', Helvetica, sans-serif"

/**
 * Composición del avatar y el nombre, en el espacio de 1672x941 del original.
 *
 * La banda util esta acotada por arriba y por abajo, y es distinta en cada
 * escena:
 *  - Por arriba, el subtitulo de la plantilla, medido a 1px sobre la columna
 *    de texto (x 70..630). Cada escena lo termina a una altura distinta, y en
 *    la misma escena el espanol y el ingles tampoco coinciden, asi que se toma
 *    siempre la mas baja de las dos.
 *  - Por abajo, X: no muestra la imagen entera, la recorta a 1.91:1 (de los 941
 *    de alto deja 875) y superpone el og:title en una caja abajo a la izquierda
 *    que arranca sobre y=788. Lo que caiga ahi queda tapado justo en la vista
 *    donde se comparte.
 *
 * Las escenas 1 y 5 dejan poco mas de 100px libres, asi que su avatar es mas
 * pequeno. Las 2, 3 y 4 tienen holgura y comparten el tamano grande.
 */

/** Composición de una escena. */
type Layout = {
  /** Diámetro del círculo del avatar. */
  d: number
  /** Esquina superior izquierda del círculo. */
  x: number
  y: number
  /** Grosor y color del aro que lo separa del fondo. */
  ring: number
  ringColor: string
  /** Cuerpo del @usuario, que se centra con el avatar. */
  font: number
}

const COMMON = { x: 86, ring: 5, ringColor: '#b6e04b' }

/**
 * Composición por escena (índice 0..4). El comentario de cada una anota desde
 * que altura esta libre la plantilla, que es de donde sale la `y`.
 */
const LAYOUTS: Layout[] = [
  { ...COMMON, y: 688, d: 98, font: 38 }, // escena 1: libre desde 674 (es)
  { ...COMMON, y: 646, d: 132, font: 50 }, // escena 2: libre desde 625 (en)
  { ...COMMON, y: 644, d: 132, font: 50 }, // escena 3: libre desde 624
  { ...COMMON, y: 646, d: 132, font: 50 }, // escena 4: libre desde 626 (es)
  { ...COMMON, y: 696, d: 90, font: 36 }, // escena 5: libre desde 682
]

/** @usuario, a la derecha del avatar. */
const HANDLE = {
  /** Separación entre el borde del avatar y la primera letra. */
  gap: 30,
  color: '#eaf5d2',
  /** Hasta dónde puede crecer el texto antes de recortarse con puntos. */
  maxRight: 900,
}

/**
 * Frases del post, alineadas por índice con las plantillas: la escena que le
 * toca a cada usuario y el texto que publica dicen lo mismo.
 */
export const SHARE_PHRASES: Record<Locale, string[]> = {
  es: [
    'Ya soy parte de Cabal.army 🐺 Radar activado: los memecoins se ven antes de que salgan.',
    'Radar activado. Ya estoy dentro de la lista de espera de Cabal.army 🐺',
    'Misión activada: soy parte de Cabal.army 🐺 Los launches, antes que nadie.',
    'En la frecuencia de Cabal.army 🐺 Me apunté a la lista de espera.',
    'Me uní al escuadrón de Cabal.army 🐺 El radar donde la comunidad los ve venir.',
  ],
  en: [
    "I'm in — part of Cabal.army 🐺 Radar on: memecoins spotted before they launch.",
    'Radar activated. I just joined the Cabal.army waitlist 🐺',
    'Mission activated: I\'m part of Cabal.army 🐺 Launches, before anyone else.',
    'Tuned in to Cabal.army 🐺 I signed up for the waitlist.',
    'I joined the Cabal.army squad 🐺 The radar where the community sees them coming.',
  ],
}

/** Cuerpo del post, bajo la frase de cabecera. */
export const SHARE_BODY: Record<Locale, string[]> = {
  es: [
    'Launches antes de que salgan, tesis de la comunidad e historial real de cada dev.',
    'Entra conmigo a la lista de espera:',
  ],
  en: [
    'Launches before they drop, community thesis and every dev\'s real track record.',
    'Join the waitlist with me:',
  ],
}

/**
 * Índice estable (0..n-1) derivado del identificador del usuario: cada persona
 * recibe siempre la misma escena y frase, pero repartidas entre todas.
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
    // X sirve el avatar en 48px por defecto; pedimos el original, que da
    // resolución de sobra para el círculo grande de la tarjeta.
    const big = url.replace(/_(normal|bigger|mini)\.(jpg|jpeg|png|webp|gif)$/i, '.$2')
    const res = await fetch(big, { signal: AbortSignal.timeout(5000) })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    // El original puede no existir para avatares antiguos: reintenta el que vino
    const fallback = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return fallback.ok ? Buffer.from(await fallback.arrayBuffer()) : null
  } catch {
    return null
  }
}

/** Silueta por defecto, para cuando el usuario no tiene avatar o falla la descarga. */
function placeholderAvatar(size: number): Buffer {
  const r = size / 2
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${r}" cy="${r}" r="${r}" fill="#16200f"/>
      <circle cx="${r}" cy="${r * 0.78}" r="${r * 0.30}" fill="#b6e04b"/>
      <path d="M ${r * 0.30} ${size} a ${r * 0.70} ${r * 0.62} 0 0 1 ${r * 1.40} 0 Z" fill="#b6e04b"/>
    </svg>`
  )
}

/**
 * Compone la tarjeta: plantilla del idioma + avatar circular con aro + @usuario.
 * Devuelve un PNG listo para servir.
 */
export async function renderShareCard(opts: {
  handle: string
  avatarUrl?: string | null
  seed?: string
  locale?: Locale
}): Promise<Buffer> {
  const locale = toLocale(opts.locale)
  const seed = opts.seed || opts.handle
  const idx = pickIndex(seed, CARD_COUNT)
  const template = path.join(process.cwd(), 'public', 'share', locale, `card-${idx + 1}.png`)

  const { d, x, y, ring, ringColor, font } = LAYOUTS[idx]
  const layers: sharp.OverlayOptions[] = []

  // Aro exterior: se pinta como un anillo completo detrás del avatar, de modo
  // que el avatar (del diámetro exacto) lo deja visible solo por fuera.
  const ringD = d + ring * 2
  layers.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ringD}" height="${ringD}">
        <circle cx="${ringD / 2}" cy="${ringD / 2}" r="${ringD / 2}" fill="${ringColor}"/>
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
  if (!avatar) {
    avatar = await sharp(placeholderAvatar(d)).png().toBuffer()
  }
  layers.push({ input: avatar, left: x, top: y })

  // @usuario centrado con el avatar. El SVG ocupa el ancho útil de la tarjeta y
  // se pega en su sitio; sharp exige que ninguna capa desborde el lienzo.
  const textX = x + d + HANDLE.gap
  const cy = y + d / 2
  const svgW = HANDLE.maxRight - textX
  const svgH = font * 2
  const handle = `@${opts.handle}`
  // 0.60em es el ancho medio de esta tipografía en negrita; recorta antes de
  // salirse del área libre en vez de invadir la ilustración.
  const maxChars = Math.floor(svgW / (font * 0.6))
  const shown = handle.length > maxChars ? `${handle.slice(0, Math.max(3, maxChars - 1))}…` : handle

  layers.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
        <text x="0" y="${svgH / 2 + font * 0.36}"
              font-family="${FONT_STACK}" font-size="${font}"
              font-weight="bold" fill="${HANDLE.color}" letter-spacing="1"
              stroke="#000000" stroke-width="6" stroke-opacity="0.45"
              paint-order="stroke">${esc(shown)}</text>
      </svg>`
    ),
    left: textX,
    top: Math.round(cy - svgH / 2),
  })

  // JPEG y no PNG a propósito: son ilustraciones fotográficas, y codificarlas
  // como PNG costaba ~1.8s frente a ~40ms en JPEG. Esa diferencia es la que
  // hacía que el rastreador de X abandonase la descarga por timeout y
  // publicase la tarjeta sin imagen.
  //
  // Medido contra las alternativas (misma plantilla, media de 6 pasadas):
  //   JPEG                    40ms  371KB   <- este
  //   JPEG + mozjpeg         238ms  347KB   comprime un 6% más a costa de ser 6x más lento
  //   WebP q80               156ms  176KB   más pequeño pero más lento, y X lo
  //                                         renderiza peor que JPEG en sus tarjetas
  // Lo que importa aquí es el tiempo, no el peso. 4:4:4 conserva nítidos los
  // bordes de color del @usuario y el aro verde; cuesta 5ms más que 4:2:0.
  return sharp(template)
    .composite(layers)
    .jpeg({ quality: 84, chromaSubsampling: '4:4:4' })
    .toBuffer()
}

/**
 * Igual que renderShareCard pero cacheando en disco: el rastreador de X pide la
 * imagen varias veces y no conviene recomponerla en cada visita.
 */
export async function getShareCard(opts: {
  handle: string
  avatarUrl?: string | null
  seed?: string
  locale?: Locale
}): Promise<Buffer> {
  const locale = toLocale(opts.locale)
  const key = createHash('sha256')
    .update(`${CARD_VERSION}|${opts.seed ?? ''}|${opts.handle}|${opts.avatarUrl ?? ''}|${locale}`)
    .digest('hex')
    .slice(0, 24)
  const dir = path.join(process.cwd(), 'upload', 'cards')
  const file = path.join(dir, `${key}.jpg`)

  try {
    return await readFile(file)
  } catch {
    // Todavía no está cacheada
  }

  const png = await renderShareCard({ ...opts, locale })
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(file, png)
  } catch {
    // Sin permisos de escritura seguimos sirviendo la imagen en memoria
  }
  return png
}
