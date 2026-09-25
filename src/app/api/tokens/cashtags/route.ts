import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cached } from '@/lib/cache'

/**
 * GET /api/tokens/cashtags
 *
 * Tabla mínima ticker → precio para pintar los "$TICKER" que la gente escribe
 * en el chat, las tesis y las descripciones. Va aparte de /api/tokens porque
 * aquella lista arrastra dev, launch y recuento de posts: aquí solo hace falta
 * lo que cabe en un chip, y se pide en cada mensaje que se pinta.
 *
 * Si dos tokens comparten ticker gana el de mayor capitalización, que es el
 * que la gente quiere decir cuando escribe el símbolo a secas.
 */
export type CashtagDTO = {
  /** token = ya cotiza (chip con precio) · launch = aún en el Radar (abre el launch) */
  kind?: 'token' | 'launch'
  id: string
  ticker: string
  name: string
  image: string | null
  network: string
  price: number
  change24h: number
  mc: number
}

export async function GET() {
  try {
    const list = await cached('tokens:cashtags', 60, async () => {
      const rows = await db.token.findMany({
        select: { id: true, ticker: true, name: true, image: true, network: true, price: true, change24h: true, mc: true },
        orderBy: { mc: 'desc' },
      })
      const byTicker = new Map<string, CashtagDTO>()
      for (const t of rows) {
        const key = t.ticker.trim().toUpperCase()
        if (key && !byTicker.has(key)) byTicker.set(key, { ...t, ticker: key, kind: 'token' })
      }
      // Tickers de launches que aún no son token: el más hypeado gana. Los
      // privados y los ocultos no, que su ticker no es público.
      const launches = await db.launch.findMany({
        where: { hidden: false, isPrivate: false, ticker: { not: null }, token: null },
        select: { id: true, ticker: true, name: true, image: true, network: true },
        orderBy: { hype: 'desc' },
      })
      for (const l of launches) {
        const key = (l.ticker ?? '').trim().replace(/^\$/, '').toUpperCase()
        if (key && !byTicker.has(key)) {
          byTicker.set(key, { ...l, ticker: key, kind: 'launch', price: 0, change24h: 0, mc: 0 })
        }
      }
      return Object.fromEntries(byTicker)
    })
    return NextResponse.json(list)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
