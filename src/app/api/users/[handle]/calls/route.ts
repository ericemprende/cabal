import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cached } from '@/lib/cache'
import { callPoints, parsePeriod, periodStart, summarizeCalls } from '@/lib/call-score'
import { kickCallResultsSync, rankCallers } from '@/lib/call-results'
import type { CallRowDTO, UserCallStatsDTO } from '@/lib/types'

/**
 * GET /api/users/<handle>/calls?period=24h|7d|30d|all — estadísticas públicas
 * de las calls de un usuario: resumen, posición en Top Callers, sus mejores
 * calls y el historial con el resultado de cada una.
 */
export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle: raw } = await params
    const handle = decodeURIComponent(raw).replace(/^@+/, '').trim()
    if (!/^\w{1,30}$/.test(handle)) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    const user = await db.user.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const period = parsePeriod(new URL(req.url).searchParams.get('period'))
    const since = periodStart(period)
    kickCallResultsSync()

    const [posts, ranking] = await Promise.all([
      db.post.findMany({
        where: {
          userId: user.id,
          kind: 'call',
          contract: { not: null },
          network: { not: null },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      cached(`leaderboard:callers:${period}`, 60, () => rankCallers(period)),
    ])

    const rows: CallRowDTO[] = posts.map((p) => ({
      id: p.id,
      content: p.content,
      network: p.network!,
      contract: p.contract!,
      symbol: p.resultSymbol,
      image: p.resultImage,
      entryMc: p.entryMc,
      peakMultiple: p.peakMultiple,
      currentMultiple: p.currentMultiple,
      points: callPoints(p.peakMultiple, p.currentMultiple),
      final: p.resultFinal,
      createdAt: p.createdAt.toISOString(),
    }))

    const evaluated = rows.filter((r) => r.peakMultiple !== null)
    const position = ranking.findIndex((r) => r.userId === user.id)
    const dto: UserCallStatsDTO = {
      period,
      summary: summarizeCalls(posts),
      rank: position >= 0 ? position + 1 : null,
      best: [...evaluated].sort((a, b) => b.peakMultiple! - a.peakMultiple!).slice(0, 5),
      calls: rows,
      pending: rows.length - evaluated.length,
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
