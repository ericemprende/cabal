import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cached } from '@/lib/cache'
import { fetchMarketBatch } from '@/lib/chain-stats'
import { sessionUserIdFromCookies } from '@/lib/auth'
import type { TrackRecordDTO } from '@/lib/types'

const DAY = 24 * 60 * 60 * 1000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** yyyy-mm-dd → inicio de ese día en UTC, o null si no es una fecha válida. */
function day(v: string | null): Date | null {
  if (!v || !ISO_DAY.test(v)) return null
  const d = new Date(`${v}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * GET /api/users/<handle>/track-record?from=yyyy-mm-dd&to=yyyy-mm-dd&wallet=<address>
 *
 * Track record de trading de un usuario: las compras y ventas que hizo DESDE
 * Cabal con sus wallets vinculadas, confirmadas on-chain (SwapIntent
 * consumida). Operaciones hechas fuera de Cabal no se ven aquí.
 *
 * Solo es público si el usuario lo activó (User.showTrackRecord); su dueño lo
 * ve siempre, para saber qué enseñaría antes de activarlo. Los importes son
 * en USD al momento de cada operación: el "flujo neto" (ventas − compras) no
 * cuenta lo que aún tenga en cartera.
 */
export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle: raw } = await params
    const handle = decodeURIComponent(raw).replace(/^@+/, '').trim()
    if (!/^\w{1,30}$/.test(handle)) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    const user = await db.user.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { id: true, showTrackRecord: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const isMe = (await sessionUserIdFromCookies()) === user.id
    if (!user.showTrackRecord && !isMe) {
      return NextResponse.json({ visible: false, isMe } satisfies Partial<TrackRecordDTO>)
    }

    const url = new URL(req.url)
    let from = day(url.searchParams.get('from'))
    let to = day(url.searchParams.get('to'))
    if (from && to && to < from) [from, to] = [to, from]
    const walletFilter = (url.searchParams.get('wallet') ?? '').trim()

    const dto = await cached(
      `track-record:${user.id}:${from?.getTime() ?? ''}:${to?.getTime() ?? ''}:${walletFilter}`,
      60,
      async (): Promise<TrackRecordDTO> => {
        const links = await db.walletLink.findMany({
          where: { userId: user.id },
          select: { network: true, address: true, label: true },
          orderBy: { createdAt: 'asc' },
        })
        const selected = walletFilter ? links.filter((l) => l.address === walletFilter) : links
        const trades = selected.length
          ? await db.swapIntent.findMany({
              where: {
                consumed: true,
                OR: selected.map((l) => ({ network: l.network, walletAddress: l.address })),
                ...(from || to
                  ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + DAY) } : {}) } }
                  : {}),
              },
              orderBy: { createdAt: 'desc' },
              take: 2000,
            })
          : []

        // Tickers de los tokens (DexScreener, en bloque)
        const market = await fetchMarketBatch([...new Set(trades.map((t) => t.mint))]).catch(() => new Map())
        const symbolOf = (mint: string) => (market.get(mint)?.symbol as string | undefined) || ''

        const summary = { trades: 0, buys: 0, sells: 0, buyUsd: 0, sellUsd: 0, volumeUsd: 0, tokens: 0, netUsd: 0, avgTradeUsd: 0, largestTradeUsd: 0 }
        const byToken = new Map<string, TrackRecordDTO['tokens'][number]>()
        const byWallet = new Map<string, { buyUsd: number; sellUsd: number; trades: number }>()
        const byDay = new Map<string, { buyUsd: number; sellUsd: number }>()

        for (const t of trades) {
          const buy = t.kind === 'buy'
          summary.trades++
          if (buy) {
            summary.buys++
            summary.buyUsd += t.amountUsd
          } else {
            summary.sells++
            summary.sellUsd += t.amountUsd
          }
          summary.largestTradeUsd = Math.max(summary.largestTradeUsd, t.amountUsd)

          const tokKey = `${t.network}:${t.mint}`
          const tok = byToken.get(tokKey) ?? {
            network: t.network,
            mint: t.mint,
            symbol: symbolOf(t.mint),
            buyUsd: 0,
            sellUsd: 0,
            netUsd: 0,
            trades: 0,
            lastAt: t.createdAt.toISOString(),
          }
          if (buy) tok.buyUsd += t.amountUsd
          else tok.sellUsd += t.amountUsd
          tok.netUsd = tok.sellUsd - tok.buyUsd
          tok.trades++
          byToken.set(tokKey, tok)

          const wKey = `${t.network}:${t.walletAddress}`
          const w = byWallet.get(wKey) ?? { buyUsd: 0, sellUsd: 0, trades: 0 }
          if (buy) w.buyUsd += t.amountUsd
          else w.sellUsd += t.amountUsd
          w.trades++
          byWallet.set(wKey, w)

          const dKey = t.createdAt.toISOString().slice(0, 10)
          const d = byDay.get(dKey) ?? { buyUsd: 0, sellUsd: 0 }
          if (buy) d.buyUsd += t.amountUsd
          else d.sellUsd += t.amountUsd
          byDay.set(dKey, d)
        }
        summary.volumeUsd = summary.buyUsd + summary.sellUsd
        summary.netUsd = summary.sellUsd - summary.buyUsd
        summary.tokens = byToken.size
        summary.avgTradeUsd = summary.trades ? summary.volumeUsd / summary.trades : 0

        // Serie diaria continua (días vacíos en 0) entre la primera y la última fecha
        const series: TrackRecordDTO['series'] = []
        if (trades.length) {
          const start = from ?? new Date(trades[trades.length - 1].createdAt.toISOString().slice(0, 10) + 'T00:00:00.000Z')
          const end = to ?? new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
          const first = Math.max(start.getTime(), end.getTime() - 365 * DAY)
          for (let ms = first; ms <= end.getTime(); ms += DAY) {
            const key = new Date(ms).toISOString().slice(0, 10)
            const d = byDay.get(key)
            series.push({ date: key, buyUsd: d?.buyUsd ?? 0, sellUsd: d?.sellUsd ?? 0 })
          }
        }

        return {
          visible: true,
          isMe,
          public: user.showTrackRecord,
          wallets: links.map((l) => {
            const w = byWallet.get(`${l.network}:${l.address}`)
            return {
              network: l.network,
              address: l.address,
              label: l.label,
              trades: w?.trades ?? 0,
              volumeUsd: (w?.buyUsd ?? 0) + (w?.sellUsd ?? 0),
              netUsd: (w?.sellUsd ?? 0) - (w?.buyUsd ?? 0),
            }
          }),
          summary,
          tokens: [...byToken.values()].sort((a, b) => b.buyUsd + b.sellUsd - (a.buyUsd + a.sellUsd)).slice(0, 50),
          series,
          recent: trades.slice(0, 50).map((t) => ({
            id: t.id,
            network: t.network,
            kind: t.kind,
            wallet: t.walletAddress,
            mint: t.mint,
            symbol: symbolOf(t.mint),
            amountUsd: t.amountUsd,
            createdAt: t.createdAt.toISOString(),
          })),
        }
      }
    )
    // isMe va fuera de la caché: la comparten el dueño y los visitantes
    return NextResponse.json({ ...dto, isMe, public: user.showTrackRecord })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
