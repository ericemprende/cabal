import { db } from '@/lib/db'
import { siteUrl } from '@/lib/waitlist'
import { rankCallers } from '@/lib/call-results'
import { fmtMultiple, parsePeriod, periodStart, type CallPeriod } from '@/lib/call-score'
import { chatLinkIdsOf, communityKeyOf, communityLabel } from '@/lib/bot-community'
import { userLink } from '@/lib/notifications'
import { esc, type BotMessage } from '@/lib/bot-message'
import { t, type Lang } from '@/lib/bot-i18n'
import { callUrl, type SourceChat } from '@/lib/bot-call'

/**
 * El leaderboard que pinta /leaderboard en Telegram y Discord.
 *
 * En un grupo o servidor sale el de esa comunidad: solo las calls que nacieron
 * allí (Post.chatLinkId). En el privado con el bot sale el global de Cabal, que
 * es el mismo ranking de Top Callers de la web.
 *
 * Las X salen de peakMultiple, que rellena lib/call-results en segundo plano;
 * una call recién dada todavía no tiene resultado y no aparece hasta que lo
 * tenga. Por eso "calls" aquí cuenta las evaluadas, no las publicadas.
 */

const TOP_CALLERS = 5
const TOP_CALLS = 10

export async function leaderboardMessage(
  chat: SourceChat | null,
  periodArg: string | null,
  lang: Lang
): Promise<BotMessage> {
  const tx = t(lang)
  const period = parsePeriod(periodArg ?? '7d')

  // En un grupo, el ámbito es su comunidad; en un privado, todo Cabal
  const key = chat ? communityKeyOf(chat) : null
  const scope = key ? await chatLinkIdsOf(key) : null
  const label = key ? await communityLabel(key) : null

  const [ranking, calls] = await Promise.all([
    rankCallers(period, scope ?? undefined),
    topCalls(period, scope),
  ])

  const lines = [tx.lbTitle(label ? esc(label) : 'Cabal'), tx.lbPeriod(periodLabel(period, lang))]

  if (ranking.length === 0) {
    lines.push('', tx.lbEmpty)
    return { text: lines.join('\n'), buttons: [[{ text: tx.openCabal, url: `${siteUrl()}/app` }]] }
  }

  const top = ranking.slice(0, TOP_CALLERS)
  const users = await db.user.findMany({
    where: { id: { in: top.map((r) => r.userId) } },
    select: { id: true, handle: true },
  })
  const handleById = new Map(users.map((u) => [u.id, u.handle]))

  lines.push('', tx.lbTopCallers)
  top.forEach((r, i) => {
    const handle = handleById.get(r.userId)
    if (!handle) return
    lines.push(
      `${medal(i)} ${userLink(handle)} — <b>${r.summary.score} pts</b> · ${r.summary.wins}/${r.summary.calls} · ${fmtMultiple(r.summary.bestMultiple)}`
    )
  })

  // Las estadísticas del ámbito completo, no solo del top 5
  const all = ranking.map((r) => r.summary)
  const totalCalls = all.reduce((n, s) => n + s.calls, 0)
  const totalWins = all.reduce((n, s) => n + s.wins, 0)
  const best = all.reduce<number | null>((b, s) => (s.bestMultiple != null && (b == null || s.bestMultiple > b) ? s.bestMultiple : b), null)
  const peaks = calls.map((c) => c.peakMultiple!).sort((a, b) => a - b)

  lines.push('', tx.lbStats)
  lines.push(
    `${tx.lbCalls} <b>${totalCalls}</b> · ${tx.lbHitRate} <b>${totalCalls ? Math.round((totalWins / totalCalls) * 100) : 0}%</b>`
  )
  lines.push(`${tx.lbMedian} <b>${fmtMultiple(median(peaks))}</b> · ${tx.lbBest} <b>${fmtMultiple(best)}</b>`)

  if (calls.length) {
    lines.push('', tx.lbTopCalls)
    calls.forEach((c, i) => {
      const symbol = c.resultSymbol || shortCa(c.contract)
      lines.push(
        `${i + 1}. <a href="${callUrl(c.id)}">$${esc(symbol)}</a> » ${userLink(c.user.handle)} <b>[${fmtMultiple(c.peakMultiple)}]</b>`
      )
    })
  }

  return {
    text: lines.join('\n'),
    buttons: [[{ text: tx.lbSeeOnCabal, url: `${siteUrl()}/app?tab=leaderboard${key ? `&community=${encodeURIComponent(key)}` : ''}` }]],
  }
}

/** Las mejores calls del periodo dentro del ámbito, por pico alcanzado. */
async function topCalls(period: CallPeriod, scope: string[] | null) {
  if (scope && scope.length === 0) return []
  const since = periodStart(period)
  return db.post.findMany({
    where: {
      kind: 'call',
      peakMultiple: { not: null },
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(scope ? { chatLinkId: { in: scope } } : {}),
    },
    orderBy: { peakMultiple: 'desc' },
    take: TOP_CALLS,
    select: {
      id: true,
      contract: true,
      resultSymbol: true,
      peakMultiple: true,
      user: { select: { handle: true } },
    },
  })
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function medal(i: number): string {
  return ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`
}

function shortCa(ca: string | null): string {
  return ca ? `${ca.slice(0, 4)}…${ca.slice(-4)}` : '???'
}

function periodLabel(period: CallPeriod, lang: Lang): string {
  const tx = t(lang)
  return period === '24h' ? tx.lbDay : period === '7d' ? tx.lbWeek : period === '30d' ? tx.lbMonth : tx.lbAll
}
