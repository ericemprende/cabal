import { PublicKey } from '@solana/web3.js'
import { PUMP_LIMITS } from '@/lib/pump-launch'
import { siteUrl } from '@/lib/waitlist'
import { launchPlatform, type LaunchPlatformId } from '@/lib/launch-platforms'

/**
 * Validación del formulario de /lanzar, compartida por el lanzamiento al
 * momento (/api/pump/prepare) y el programado (/api/pump/schedule/setup).
 */

export type PumpForm = {
  platform: LaunchPlatformId
  mint: string
  creator: string
  name: string
  symbol: string
  description: string
  image: string
  twitter: string | null
  telegram: string | null
  website: string | null
  initialBuySol: number
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export function pubkey(v: unknown): string | null {
  if (typeof v !== 'string') return null
  try {
    return new PublicKey(v).toBase58()
  } catch {
    return null
  }
}

function link(v: unknown): string | null {
  const s = str(v, 300)
  if (!s) return null
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

export function parsePumpForm(body: Record<string, unknown>): { ok: true; data: PumpForm } | { ok: false; error: string } {
  const platform = launchPlatform(String(body.platform ?? 'pump'))
  if (!platform.live) return { ok: false, error: `${platform.name} todavía no está disponible` }
  const mint = pubkey(body.mint)
  const creator = pubkey(body.creator)
  const name = str(body.name, platform.limits.name)
  const symbol = str(body.symbol, platform.limits.symbol).replace(/^\$/, '').toUpperCase()
  const description = str(body.description, PUMP_LIMITS.description)
  let image = str(body.image, 500)
  const initialBuySol = Math.max(0, Number(body.initialBuySol) || 0)

  if (!mint || !creator) return { ok: false, error: 'Falta la wallet o la dirección del token' }
  if (!name || !symbol) return { ok: false, error: 'El nombre y el ticker son obligatorios' }
  if (!image) return { ok: false, error: 'Sube la imagen del token' }
  if (initialBuySol > PUMP_LIMITS.maxInitialBuySol) {
    return { ok: false, error: `La compra inicial máxima es ${PUMP_LIMITS.maxInitialBuySol} SOL` }
  }
  if (image.startsWith('/')) image = `${siteUrl()}${image}`
  if (!/^https:\/\//i.test(image)) return { ok: false, error: 'La imagen no es válida' }

  return {
    ok: true,
    data: {
      platform: platform.id as LaunchPlatformId,
      mint,
      creator,
      name,
      symbol,
      description,
      image,
      twitter: link(body.twitter),
      telegram: link(body.telegram),
      website: link(body.website),
      initialBuySol,
    },
  }
}
