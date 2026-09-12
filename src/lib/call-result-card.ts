import sharp from 'sharp'

/**
 * Tarjeta de resultado de una call, para compartir fuera de Cabal. A
 * diferencia de la tarjeta de la lista de espera (`share-card.ts`, que
 * viaja como og:image porque X no admite adjuntos en el intent), esta se
 * sirve como imagen directa: el botón del feed la abre para que el usuario
 * la guarde o comparta a mano en cualquier red.
 *
 * Enteramente generada por SVG (sin plantillas PNG): el contenido es
 * dinámico (ticker, %, handle) y no hay una ilustración fija que vestir.
 */

export const CALL_CARD_W = 1200
export const CALL_CARD_H = 675

const FONT_STACK = "'Liberation Sans', Arial, 'DejaVu Sans', Helvetica, sans-serif"
const MONO_STACK = "'Liberation Mono', 'DejaVu Sans Mono', Consolas, monospace"

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://cabal.army').replace(/\/+$/, '')
}

async function fetchAvatar(url: string | null): Promise<Buffer | null> {
  if (!url) return null
  try {
    const abs = url.startsWith('/') ? `${siteUrl()}${url}` : url
    const big = abs.replace(/_(normal|bigger|mini)\.(jpg|jpeg|png|webp|gif)$/i, '.$2')
    const res = await fetch(big, { signal: AbortSignal.timeout(5000) })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    const fallback = await fetch(abs, { signal: AbortSignal.timeout(5000) })
    return fallback.ok ? Buffer.from(await fallback.arrayBuffer()) : null
  } catch {
    return null
  }
}

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

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(n >= 100 || n <= -100 ? 0 : 1)}%`
}

function fmtElapsed(ms: number): string {
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export async function renderCallResultCard(opts: {
  handle: string
  avatarUrl?: string | null
  symbol: string
  contract: string
  pctChange: number | null
  calledAt: Date
}): Promise<Buffer> {
  const { handle, avatarUrl, symbol, contract, pctChange, calledAt } = opts
  const up = (pctChange ?? 0) >= 0
  const accent = pctChange === null ? '#9aa08a' : up ? '#8FA83F' : '#e5484d'
  const pctText = pctChange === null ? 'sin datos aún' : fmtPct(pctChange)
  const elapsed = fmtElapsed(Date.now() - calledAt.getTime())
  const shortCa = contract.length > 26 ? `${contract.slice(0, 12)}…${contract.slice(-8)}` : contract

  const d = 84 // avatar
  const raw = await fetchAvatar(avatarUrl ?? null)
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`
  )
  let avatar: Buffer
  if (raw) {
    try {
      avatar = await sharp(raw)
        .resize(d, d, { fit: 'cover' })
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toBuffer()
    } catch {
      avatar = await sharp(placeholderAvatar(d)).png().toBuffer()
    }
  } else {
    avatar = await sharp(placeholderAvatar(d)).png().toBuffer()
  }

  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CALL_CARD_W}" height="${CALL_CARD_H}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0e120a"/>
          <stop offset="100%" stop-color="#080a06"/>
        </linearGradient>
        <radialGradient id="glow" cx="85%" cy="10%" r="60%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.20"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${CALL_CARD_W}" height="${CALL_CARD_H}" fill="url(#g)"/>
      <rect width="${CALL_CARD_W}" height="${CALL_CARD_H}" fill="url(#glow)"/>
      <rect x="0" y="0" width="${CALL_CARD_W}" height="10" fill="${accent}"/>

      <text x="70" y="90" font-family="${FONT_STACK}" font-size="34" font-weight="800" fill="#eaf5d2" letter-spacing="1">
        🐺 CABAL.ARMY
      </text>
      <text x="70" y="132" font-family="${FONT_STACK}" font-size="22" fill="#9aa08a">
        Resultado de la call · publicada hace ${esc(elapsed)}
      </text>

      <text x="70" y="330" font-family="${FONT_STACK}" font-size="150" font-weight="900" fill="${accent}">
        ${esc(pctText)}
      </text>
      <text x="70" y="390" font-family="${FONT_STACK}" font-size="40" font-weight="700" fill="#f4f7ee">
        ${esc(symbol ? `$${symbol}` : 'token')}
      </text>

      <text x="70" y="545" font-family="${MONO_STACK}" font-size="24" fill="#9aa08a">
        CA: ${esc(shortCa)}
      </text>

      <text x="${70 + d + 30}" y="${CALL_CARD_H - 55}" font-family="${FONT_STACK}" font-size="30" font-weight="700" fill="#eaf5d2">
        @${esc(handle)}
      </text>
      <text x="${70 + d + 30}" y="${CALL_CARD_H - 24}" font-family="${FONT_STACK}" font-size="20" fill="#9aa08a">
        via cabal.army
      </text>
    </svg>`
  )

  return sharp(bg)
    .composite([{ input: avatar, left: 70, top: CALL_CARD_H - 55 - 84 + 18 }])
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toBuffer()
}
