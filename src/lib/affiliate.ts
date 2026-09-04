import { db } from '@/lib/db'

/** Presets de plataformas afiliadas que se auto-crean la primera vez. */
export const AFFILIATE_PRESETS: { name: string; slug: string; order: number }[] = [
  { name: 'GMGN', slug: 'gmgn', order: 1 },
  { name: 'Axiom Pro', slug: 'axiom', order: 2 },
  { name: 'Photon', slug: 'photon', order: 3 },
  { name: 'BullX', slug: 'bullx', order: 4 },
  { name: 'Birdeye', slug: 'birdeye', order: 5 },
  { name: 'DEXScreener', slug: 'dexscreener', order: 6 },
]

/** Garantiza que los presets existan (idempotente, corre una sola vez por BD vacía). */
export async function ensureAffiliatePresets() {
  const count = await db.affiliatePlatform.count()
  if (count > 0) return
  await db.affiliatePlatform.createMany({
    data: AFFILIATE_PRESETS.map((p) => ({ ...p, url: '', active: false })),
  })
}

/** Valida el enlace madre de referido (https obligatorio). */
export function isValidAffiliateUrl(v: string): boolean {
  return /^https:\/\/\S+$/i.test(v.trim())
}

/**
 * Resuelve el enlace final de una plataforma para un token concreto.
 * Si el enlace madre incluye {ca}, se sustituye por el contrato; si no,
 * se devuelve tal cual (enlace madre puro de referido).
 */
export function resolveAffiliateUrl(template: string, contract?: string | null): string {
  if (!contract) return template
  return template.replaceAll('{ca}', encodeURIComponent(contract))
}
