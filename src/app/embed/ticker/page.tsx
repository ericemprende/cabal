import type { Metadata } from 'next'
import { EmbedTicker } from './embed-ticker'
import type { TickerSpeed } from '@/components/cabal/ticker'

export const metadata: Metadata = { title: 'Cabal — Ticker', robots: { index: false } }

/**
 * Barra de tokens sola, para OBS (fuente de navegador) o un <iframe>.
 * ?ids=a,b  solo esos tokens (sin ids: todos) · ?speed=slow|fast · ?bg=solid
 */
export default async function EmbedTickerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const ids = (one(sp.ids) ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const speedParam = one(sp.speed)
  const speed: TickerSpeed = speedParam === 'slow' || speedParam === 'fast' ? speedParam : 'normal'
  const solid = one(sp.bg) === 'solid'
  return <EmbedTicker ids={ids} speed={speed} solid={solid} />
}
