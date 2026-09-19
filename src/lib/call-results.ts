import { db } from '@/lib/db'
import { fetchCallResult, type CallResult } from '@/lib/chain-stats'
import { cached, invalidate } from '@/lib/cache'
import { safeRedis } from '@/lib/redis'
import { periodStart, summarizeCalls, type CallPeriod, type CallSummary } from '@/lib/call-score'

/**
 * Resultado guardado de las calls.
 *
 * Antes el % de una call solo se calculaba al abrirla, contra DexScreener y
 * GeckoTerminal, y nunca se guardaba: el ranking de Top Callers dependía de
 * cabalScore/callsWon/callsTotal, que nadie actualizaba, y salía vacío. Aquí
 * se revisan las calls abiertas poco a poco, se guarda su pico y su X actual,
 * y se recalculan los totales del usuario.
 *
 * GeckoTerminal gratuito admite ~30 peticiones por minuto y cada call gasta
 * entre dos y cuatro, así que cada pasada revisa pocas y con más frecuencia las
 * recientes, que es cuando más se mueven.
 */

const HOUR = 3600_000
const DAY = 24 * HOUR
/** Pasado este tiempo la call se revisa una última vez y queda fija. */
const FINAL_AFTER = 30 * DAY
/** Calls revisadas por pasada. */
const BATCH = 6
/** Mínimo entre pasadas lanzadas desde las visitas a la web. */
const MIN_GAP_SECONDS = 90
/** Pausa entre calls de una misma pasada. */
const CALL_GAP_MS = 3000
/** Si una revisión se quedó sin velas, se reintenta tras esto. */
const RETRY_MS = 5 * 60_000

/** Cada cuánto se vuelve a revisar una call según su edad. */
function recheckEvery(ageMs: number): number {
  if (ageMs < DAY) return 10 * 60_000
  if (ageMs < 7 * DAY) return HOUR
  return 6 * HOUR
}

function isDue(createdAt: Date, checkedAt: Date | null, now: number): boolean {
  if (!checkedAt) return true
  const age = now - createdAt.getTime()
  if (age >= FINAL_AFTER) return true // última revisión, para cerrarla
  return now - checkedAt.getTime() >= recheckEvery(age)
}

/** Una pasada: revisa las calls pendientes más atrasadas. Devuelve cuántas revisó. */
export async function syncCallResults(limit = BATCH): Promise<number> {
  const now = Date.now()
  // Candidatas: nunca revisadas primero, luego las revisadas hace más tiempo
  const candidates = await db.post.findMany({
    where: { kind: 'call', resultFinal: false, contract: { not: null }, network: { not: null } },
    orderBy: [{ resultCheckedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      userId: true,
      contract: true,
      network: true,
      createdAt: true,
      entryPriceUsd: true,
      entryMc: true,
      peakMultiple: true,
      resultCheckedAt: true,
    },
  })
  const due = candidates.filter((c) => isDue(c.createdAt, c.resultCheckedAt, now)).slice(0, limit)
  if (due.length === 0) return 0

  const touchedUsers = new Set<string>()
  for (const [i, call] of due.entries()) {
    // Espaciadas: cada call gasta hasta 3-4 peticiones de velas y una pasada
    // seguida chocaba con el límite de GeckoTerminal (429 = pico sin datos)
    if (i > 0) await new Promise((r) => setTimeout(r, CALL_GAP_MS))
    const final = now - call.createdAt.getTime() >= FINAL_AFTER
    try {
      const r = await fetchCallResult(call.network!, call.contract!, call.createdAt, {
        priceUsd: call.entryPriceUsd,
        mc: call.entryMc,
      })
      const entry = r.entryPriceUsd
      const current = entry && r.currentPriceUsd ? r.currentPriceUsd / entry : null
      // El pico nunca baja: una revisión con menos velas no puede borrar un
      // máximo ya visto. Salvo si la entrada se corrigió: el pico guardado se
      // midió contra una entrada falsa y no vale.
      const stored = r.entryCorrected ? null : call.peakMultiple
      const freshPeak = r.peakMultiple ?? (current !== null ? Math.max(current, 1) : null)
      const peak = freshPeak !== null || stored !== null ? Math.max(freshPeak ?? 0, stored ?? 0) : null
      // Sin velas (GeckoTerminal limitó o falló) el pico es provisional: se
      // reintenta en unos minutos en vez de esperar a la revisión normal
      const retrySoon = r.found && r.peakMultiple === null && !final
      const checkedAt = retrySoon
        ? new Date(Date.now() - recheckEvery(now - call.createdAt.getTime()) + RETRY_MS)
        : new Date()
      await db.post.update({
        where: { id: call.id },
        data: {
          resultCheckedAt: checkedAt,
          resultFinal: final,
          ...(r.found
            ? {
                peakMultiple: peak,
                currentMultiple: current,
                resultSymbol: r.symbol || undefined,
                resultImage: r.image || undefined,
                // Guarda la entrada reconstruida (o corregida) para no volver a pedir la vela
                ...((call.entryPriceUsd === null || r.entryCorrected) && entry ? { entryPriceUsd: entry } : {}),
                ...((call.entryMc === null || r.entryCorrected) && r.entryMc ? { entryMc: r.entryMc } : {}),
              }
            : {}),
        },
      })
      touchedUsers.add(call.userId)
    } catch (e) {
      console.error('[call-results]', call.id, (e as Error).message)
      // Se marca igual para no atascar la cola con una call que siempre falla
      await db.post.update({ where: { id: call.id }, data: { resultCheckedAt: new Date(), resultFinal: final } })
    }
  }

  for (const userId of touchedUsers) await refreshUserCallTotals(userId)
  if (touchedUsers.size) await invalidate('leaderboard:*')
  return due.length
}

type CallPost = {
  id: string
  userId: string
  network: string
  contract: string
  createdAt: Date
  entryPriceUsd: number | null
  entryMc: number | null
  peakMultiple: number | null
}

/**
 * Resultado en vivo de una call (tarjeta, feed, /pnl del bot). Solo pide el
 * precio actual a DexScreener: el pico es el que guardó syncCallResults, que
 * es lo ÚNICO que pide velas a GeckoTerminal. Antes cada tarjeta vista pedía
 * 3-4 series de velas; con varias personas en el feed se pasaba el límite de
 * GeckoTerminal (429) y los picos se quedaban en el valor provisional.
 *  - Pico = el guardado, o el precio actual si es más alto (y se guarda).
 *  - Sin pico guardado todavía (call aún no revisada): pico null, la tarjeta
 *    enseña el % y se lanza una revisión en segundo plano.
 */
export async function liveCallResult(post: CallPost): Promise<CallResult> {
  const result = await cached(`call-result:${post.id}`, 60, () =>
    fetchCallResult(
      post.network,
      post.contract,
      post.createdAt,
      { priceUsd: post.entryPriceUsd, mc: post.entryMc },
      { candles: false }
    )
  )
  kickCallResultsSync()
  if (!result.found) return result
  const entry = result.entryPriceUsd
  const current = entry && result.currentPriceUsd ? result.currentPriceUsd / entry : null
  const stored = post.peakMultiple
  if (stored === null) return { ...result, peakMultiple: null, peakMc: null, peakPriceUsd: null, peakAt: null }

  const peak = Math.max(stored, current ?? 0)
  if (current !== null && current > stored + 0.005) {
    await db.post.update({ where: { id: post.id }, data: { peakMultiple: current } }).catch(() => {})
    await refreshUserCallTotals(post.userId).catch(() => {})
    await invalidate('leaderboard:*').catch(() => {})
  }
  return {
    ...result,
    peakMultiple: peak,
    peakMc: result.entryMc !== null ? Math.round(result.entryMc * peak) : null,
    peakPriceUsd: entry !== null ? entry * peak : null,
    peakAt: null,
  }
}

/** Totales de siempre del usuario (perfil, badges, pestaña Devs). */
export async function refreshUserCallTotals(userId: string) {
  const rows = await db.post.findMany({
    where: { userId, kind: 'call' },
    select: { peakMultiple: true, currentMultiple: true },
  })
  const s = summarizeCalls(rows)
  await db.user.update({
    where: { id: userId },
    data: { cabalScore: s.score, callsWon: s.wins, callsTotal: s.calls },
  })
}

declare global {
  var __cabalCallSyncAt: number | undefined
}

/**
 * Lanza una pasada en segundo plano si toca, sin hacer esperar a quien visita.
 * Se llama desde el ranking y el perfil: así los resultados se mantienen al día
 * sin otro servicio en el servidor. Con Redis, el candado evita pasadas
 * simultáneas entre procesos; sin Redis basta con el de memoria.
 */
export function kickCallResultsSync() {
  const now = Date.now()
  if (globalThis.__cabalCallSyncAt && now - globalThis.__cabalCallSyncAt < MIN_GAP_SECONDS * 1000) return
  globalThis.__cabalCallSyncAt = now
  void (async () => {
    const locked = await safeRedis(
      (c) => c.set('cabal:lock:call-results', String(now), 'EX', MIN_GAP_SECONDS, 'NX'),
      'OK'
    )
    if (locked !== 'OK') return
    await syncCallResults()
  })().catch((e) => console.error('[call-results]', (e as Error).message))
}

export type CallerRanking = { userId: string; summary: CallSummary }[]

/**
 * Top Callers de un periodo: calls publicadas desde el inicio del periodo y ya
 * evaluadas. Orden: Cabal Score, luego aciertos, luego mejor X.
 *
 * Con `chatLinkIds` el ranking se limita a las calls nacidas en esos chats: es
 * el leaderboard de una comunidad (ver lib/bot-community). Una lista vacía no
 * es "sin filtro", es una comunidad sin chats, así que devuelve vacío.
 */
export async function rankCallers(period: CallPeriod, chatLinkIds?: string[]): Promise<CallerRanking> {
  if (chatLinkIds && chatLinkIds.length === 0) return []
  const since = periodStart(period)
  const rows = await db.post.findMany({
    where: {
      kind: 'call',
      peakMultiple: { not: null },
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(chatLinkIds ? { chatLinkId: { in: chatLinkIds } } : {}),
    },
    select: { userId: true, peakMultiple: true, currentMultiple: true },
  })
  const byUser = new Map<string, typeof rows>()
  for (const r of rows) {
    const list = byUser.get(r.userId)
    if (list) list.push(r)
    else byUser.set(r.userId, [r])
  }
  return [...byUser.entries()]
    .map(([userId, list]) => ({ userId, summary: summarizeCalls(list) }))
    .sort(
      (a, b) =>
        b.summary.score - a.summary.score ||
        b.summary.wins - a.summary.wins ||
        (b.summary.bestMultiple ?? 0) - (a.summary.bestMultiple ?? 0) ||
        a.summary.calls - b.summary.calls
    )
}
