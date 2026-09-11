import sharp from 'sharp'
import { db } from '@/lib/db'
import { seededRandom } from '@/lib/api-helpers'
import { liveMarketFor, pctChange } from '@/lib/calls'
import { fetchTokenMeta } from '@/lib/chain-stats'
import { getIpfsImage } from '@/lib/ipfs-cache'
import { ipfsCid } from '@/lib/remote-image'
import { readUpload } from '@/lib/uploads'
import type { CallEvidenceDTO, PublicUserDTO } from '@/lib/types'

/**
 * Tarjeta de evidencia de una call: a qué precio se llamó el contrato, en qué
 * casa se encontró y cómo le fue desde entonces. Se genera entera como un SVG
 * (fondo, texto, gráfico) que sharp rasteriza; solo el avatar y el logo del
 * token son imágenes de verdad, compuestas encima igual que en share-card.ts.
 *
 * A diferencia de la tarjeta de invitación, esta no se cachea en disco: el
 * precio actual cambia, así que cada descarga se compone al vuelo.
 */

const W = 1080
const H = 1160
/** Alto de la franja verde inferior donde va el pie de página. */
const FOOTER_H = 110
const PAD = 28 // marco exterior de color
const FONT_STACK = "'Liberation Sans', Arial, 'DejaVu Sans', Helvetica, sans-serif"
const FONT_MONO = "'Liberation Mono', 'Courier New', monospace"

const GREEN = '#8FA83F'
const RED = '#ff5c5c'
const BG = '#0a0b08'
const PANEL = '#121410'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** "$1.2M" / "$48.8K" / "$84" — igual que fmtMc pero autocontenido (sin importar de cliente). */
function fmtUsd(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

/**
 * Trae la imagen tal cual la tenga guardada Cabal. Los avatares y logos casi
 * siempre son rutas propias (subidos o copia de IPFS): se leen directo del
 * disco, no por HTTP — esta función corre en el propio servidor y esas rutas
 * son relativas, sin origen que pedirles.
 */
async function fetchImage(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null
  try {
    if (url.startsWith('/uploads/')) return await readUpload(url.slice('/uploads/'.length))
    const cidFromApi = url.match(/^\/api\/img\/ipfs\/([^/?#]+)/)?.[1]
    const cid = cidFromApi ?? ipfsCid(url)
    if (cid) return await getIpfsImage(cid)
    if (/^https:\/\//i.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null
    }
    return null // emoji u otro valor que no es una imagen
  } catch {
    return null
  }
}

/** Círculo con una imagen dentro (avatar o logo del token), o un círculo con la inicial si no hay foto. */
async function circle(url: string | null | undefined, d: number, fallbackLetter: string, fallbackBg: string): Promise<Buffer> {
  const raw = await fetchImage(url)
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`)
  if (raw) {
    try {
      return await sharp(raw).resize(d, d, { fit: 'cover' }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
    } catch {
      // sigue al placeholder
    }
  }
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}">
        <circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="${fallbackBg}"/>
        <text x="50%" y="54%" text-anchor="middle" font-family="${FONT_STACK}" font-weight="bold"
              font-size="${d * 0.42}" fill="#0a0b08">${esc(fallbackLetter.toUpperCase())}</text>
      </svg>`
    )
  )
    .png()
    .toBuffer()
}

/** Línea del gráfico: un paseo aleatorio (con semilla) desde la entrada hasta el precio actual, siempre terminando en él. */
function sparklinePath(seed: string, x0: number, y0: number, w: number, h: number, up: boolean): string {
  const rnd = seededRandom(seed)
  const n = 28
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    // tendencia suave hacia arriba o abajo + ruido, siempre normalizado a [0,1] al final
    const trend = up ? t : 1 - t
    const noise = (rnd() - 0.5) * 0.18
    let v = trend * 0.75 + noise
    if (i === n - 1) v = up ? 0.97 : 0.03 // termina claramente arriba o abajo
    if (i === 0) v = up ? 0.08 : 0.55
    pts.push([x0 + t * w, y0 + h - Math.max(0.02, Math.min(0.98, v)) * h])
  }
  return pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
}

export type CallCardData = {
  postId: string
  createdAt: Date
  user: Pick<PublicUserDTO, 'name' | 'handle' | 'avatar'>
  call: CallEvidenceDTO
  /** Nombre/ticker/imagen del proyecto, si se conocen (launch o token enlazado). */
  project?: { name: string; ticker: string | null; image: string | null } | null
}

export async function renderCallCard(data: CallCardData): Promise<Buffer> {
  const { call } = data
  const current = call.currentMc ?? call.entryMc
  const pct = call.pctChange
  const up = (pct ?? 0) >= 0
  const color = up ? GREEN : RED
  const sign = up ? '+' : ''

  // Nombre del proyecto: el enlazado en Cabal, o el que devuelva el buscador por CA
  let project = data.project ?? null
  if (!project) {
    const meta = await fetchTokenMeta(call.contract).catch(() => null)
    project = meta?.found ? { name: meta.name, ticker: meta.symbol || null, image: meta.image || null } : null
  }
  const projectLabel = project?.ticker ? `$${project.ticker}` : project?.name || 'Token'

  const date = data.createdAt.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

  const innerW = W - PAD * 2
  const [avatar, tokenIcon] = await Promise.all([
    circle(data.user.avatar, 96, data.user.name?.[0] ?? data.user.handle[0] ?? '?', GREEN),
    circle(project?.image, 64, projectLabel.replace(/^\$/, '')[0] ?? '?', '#3a3f2e'),
  ])

  const chartX = PAD + 40
  const chartY = 220
  const chartW = innerW - 80
  const chartH = 260
  const path = sparklinePath(call.contract + data.postId, chartX, chartY, chartW, chartH, up)
  const markerX = chartX
  const markerY = chartY + chartH - (up ? 0.08 : 0.55) * chartH

  const panelY = chartY + chartH + 60
  const panelH = 380
  const panelX = PAD + 24
  const panelW = innerW - 48

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1.3" fill="#ffffff" opacity="0.06"/>
    </pattern>
  </defs>
  <!-- marco -->
  <rect width="${W}" height="${H}" rx="28" fill="${GREEN}"/>
  <rect x="${PAD}" y="${PAD}" width="${innerW}" height="${H - PAD * 2 - FOOTER_H}" rx="22" fill="${BG}"/>
  <rect x="${PAD}" y="${PAD}" width="${innerW}" height="${H - PAD * 2 - FOOTER_H}" rx="22" fill="url(#dots)"/>

  <!-- cabecera -->
  <text x="${PAD + 40 + 112}" y="${PAD + 66}" font-family="${FONT_STACK}" font-weight="bold" font-size="40" fill="#ffffff">${esc(data.user.name)}</text>
  <text x="${PAD + 40 + 112}" y="${PAD + 66}" dy="46" font-family="${FONT_STACK}" font-size="26" fill="#8b917f">@${esc(data.user.handle)}</text>
  <text x="${W - PAD - 40}" y="${PAD + 56}" text-anchor="end" font-family="${FONT_STACK}" font-size="26" fill="#8b917f">${esc(date)}</text>

  <!-- gráfico -->
  <path d="${path}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${markerX}" cy="${markerY}" r="20" fill="${color}"/>
  <line x1="${markerX}" y1="${markerY - 11}" x2="${markerX}" y2="${markerY + 11}" stroke="${BG}" stroke-width="4.5" stroke-linecap="round"/>
  <line x1="${markerX - 11}" y1="${markerY}" x2="${markerX + 11}" y2="${markerY}" stroke="${BG}" stroke-width="4.5" stroke-linecap="round"/>
  <text x="${markerX}" y="${markerY - 34}" text-anchor="middle" font-family="${FONT_STACK}" font-weight="bold" font-size="22" fill="${color}">CALL</text>

  <!-- panel -->
  <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="20" fill="${PANEL}" stroke="#ffffff" stroke-opacity="0.08"/>
  <text x="${W / 2}" y="${panelY + 74}" text-anchor="middle" font-family="${FONT_STACK}" font-weight="bold" font-size="34" fill="#ffffff">${esc(projectLabel)}</text>
  <line x1="${panelX + 40}" y1="${panelY + 100}" x2="${panelX + panelW - 40}" y2="${panelY + 100}" stroke="#ffffff" stroke-opacity="0.1"/>

  <text x="${W / 2}" y="${panelY + 205}" text-anchor="middle" font-family="${FONT_MONO}" font-weight="bold" font-size="84" fill="${color}">${sign}${pct == null ? '—' : `${pct.toFixed(1)}%`}</text>

  <line x1="${panelX + 40}" y1="${panelY + 250}" x2="${panelX + panelW - 40}" y2="${panelY + 250}" stroke="#ffffff" stroke-opacity="0.1"/>

  <text x="${panelX + panelW * 0.18}" y="${panelY + 300}" text-anchor="middle" font-family="${FONT_STACK}" font-size="22" fill="#8b917f">Entrada (MC)</text>
  <text x="${panelX + panelW * 0.18}" y="${panelY + 340}" text-anchor="middle" font-family="${FONT_STACK}" font-weight="bold" font-size="30" fill="#ffffff">${esc(fmtUsd(call.entryMc))}</text>

  <text x="${panelX + panelW * 0.5}" y="${panelY + 300}" text-anchor="middle" font-family="${FONT_STACK}" font-size="22" fill="#8b917f">Casa</text>
  <text x="${panelX + panelW * 0.5}" y="${panelY + 340}" text-anchor="middle" font-family="${FONT_STACK}" font-weight="bold" font-size="26" fill="#ffffff">${esc(call.dexId || '—')}</text>

  <text x="${panelX + panelW * 0.82}" y="${panelY + 300}" text-anchor="middle" font-family="${FONT_STACK}" font-size="22" fill="#8b917f">Actual (MC)</text>
  <text x="${panelX + panelW * 0.82}" y="${panelY + 340}" text-anchor="middle" font-family="${FONT_STACK}" font-weight="bold" font-size="30" fill="${current == null ? '#8b917f' : '#ffffff'}">${current == null ? 'Sin dato' : esc(fmtUsd(current))}</text>

  <text x="${W / 2}" y="${panelY + panelH + 40}" text-anchor="middle" font-family="${FONT_MONO}" font-size="20" fill="#5c6152">${esc(call.contract.slice(0, 6))}…${esc(call.contract.slice(-6))}</text>

  <!-- pie, sobre el marco verde: texto oscuro, no el gris pensado para el panel negro -->
  <text x="${PAD + 40}" y="${H - 58}" font-family="${FONT_STACK}" font-weight="bold" font-size="34" fill="#101403" letter-spacing="1">CABAL</text>
  <text x="${W - PAD - 40}" y="${H - 58}" text-anchor="end" font-family="${FONT_STACK}" font-weight="bold" font-size="26" fill="#101403" opacity="0.75">cabal.army</text>
</svg>`

  return sharp(Buffer.from(svg))
    .composite([
      { input: avatar, left: PAD + 40, top: PAD + 24 },
      { input: tokenIcon, left: Math.round(W / 2 - panelW / 2 + 40 - 64 - 16), top: panelY + 40 },
    ])
    .png()
    .toBuffer()
}

/** Recopila lo necesario del post para renderizar su tarjeta. */
export async function callCardDataFor(postId: string): Promise<CallCardData | null> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { user: true, launch: true, token: true },
  })
  if (!post || post.kind !== 'call' || !post.contract || !post.entryPriceUsd || !post.entryMc) return null

  const market = await liveMarketFor([post.contract])
  const live = market.get(post.contract)

  return {
    postId: post.id,
    createdAt: post.createdAt,
    user: { name: post.user.name, handle: post.user.handle, avatar: post.user.avatar },
    project: post.launch
      ? { name: post.launch.name, ticker: post.launch.ticker, image: post.launch.image }
      : post.token
        ? { name: post.token.name, ticker: post.token.ticker, image: post.token.image }
        : null,
    call: {
      contract: post.contract,
      network: post.network ?? 'solana',
      dexId: post.entryDexId ?? '',
      pairUrl: post.entryPairUrl ?? '',
      entryPriceUsd: post.entryPriceUsd,
      entryMc: post.entryMc,
      currentPriceUsd: live?.priceUsd ?? null,
      currentMc: live?.marketCap ?? null,
      pctChange: pctChange(post.entryMc, live?.marketCap ?? null),
    },
  }
}
