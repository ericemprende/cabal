import { db } from '@/lib/db'
import { fetchHolders, fetchMarketBatch, fetchTokenMeta } from '@/lib/chain-stats'

/**
 * La pestaña Tokens se alimenta de los launches del Radar que ya salieron.
 *
 * Hasta ahora no había ningún camino que creara tokens: el seed dejó de generar
 * los de ejemplo y /publicar crea launches, así que la pestaña estaba siempre
 * vacía. Y los datos de mercado (precio, market cap, volumen) no los refrescaba
 * nadie.
 *
 * Aquí se hacen las dos cosas, sin cron: la primera petición a la pestaña tras
 * un minuto de reposo dispara la sincronización. La app corre en un único
 * contenedor, así que basta con un control en memoria.
 */

/** Cada cuánto se sincroniza como mucho. */
const EVERY_MS = 60_000
/** Lo que se deja esperar a la petición que dispara la sincronización. */
const MAX_WAIT_MS = 5_000
/** Launches convertidos por pasada, para no alargar la primera de todas. */
const BATCH = 50

let lastRun = 0
let running: Promise<void> | null = null

/**
 * Quién figura como dev del token nuevo.
 *
 * Solo hay dev cuando se sabe de verdad: el launch lo publicó su propio dev, o
 * alguien lo reclamó y se verificó. Si lo publicó un scout, el token queda sin
 * dev hasta que se reclame; si no, el scout acumularía como "historial de dev"
 * proyectos que solo encontró (y un rug ajeno le mancharía la reputación).
 */
async function devFor(launch: { id: string; createdById: string; submitterRole: string }) {
  const claim = await db.projectClaim.findFirst({
    where: { targetType: 'launch', targetId: launch.id, status: 'verified' },
    select: { userId: true },
  })
  if (claim) return claim.userId
  return launch.submitterRole === 'dev' ? launch.createdById : null
}

/** Crea el token de cada launch que ya salió y tiene contrato. */
async function syncLaunchedTokens(): Promise<void> {
  const launches = await db.launch.findMany({
    where: { launchAt: { lte: new Date() }, contract: { not: null }, hidden: false, token: { is: null } },
    orderBy: { launchAt: 'desc' },
    take: BATCH,
  })

  for (const launch of launches) {
    const contract = launch.contract as string
    // Si ya hay un token con ese contrato (dos launches del mismo proyecto, o
    // uno creado a mano) no se duplica: se enlaza si está libre, o se deja.
    const existing = await db.token.findFirst({ where: { contract }, select: { id: true, launchId: true } })
    if (existing) {
      if (!existing.launchId) {
        await db.token.update({ where: { id: existing.id }, data: { launchId: launch.id } }).catch(() => {})
      }
      continue
    }

    // Un launch privado pudo anunciarse sin ticker; ya salió, así que se busca
    let ticker = launch.ticker
    if (!ticker) {
      const meta = await fetchTokenMeta(contract).catch(() => null)
      ticker = meta?.symbol || launch.name.slice(0, 12).toUpperCase()
    }

    await db.token
      .create({
        data: {
          name: launch.name,
          ticker,
          emoji: launch.emoji,
          image: launch.image,
          network: launch.network,
          contract,
          launchedAt: launch.launchAt,
          launchId: launch.id,
          devId: await devFor(launch),
          top10Pct: launch.top10Pct,
          // Precio y market cap reales los pone refreshMarket en esta misma pasada
          price: 0,
        },
      })
      .catch(() => {}) // Otra petición lo creó a la vez: launchId es único
  }
}

/** Refresca precio, market cap, volumen y variación de todos los tokens. */
async function refreshMarket(): Promise<void> {
  const tokens = await db.token.findMany({
    where: { contract: { not: '' } },
    select: { id: true, contract: true, athMc: true },
  })
  if (tokens.length === 0) return

  const market = await fetchMarketBatch(tokens.map((t) => t.contract))
  await Promise.all(
    tokens.map((t) => {
      const m = market.get(t.contract)
      // Sin par todavía (en la curva de pump.fun): se deja lo que hubiera
      if (!m) return null
      return db.token
        .update({
          where: { id: t.id },
          data: {
            price: m.priceUsd,
            mc: m.marketCap,
            volume24h: m.volume24h,
            change24h: m.change24h,
            // El máximo que se ha visto desde que se sigue el token
            athMc: Math.max(t.athMc, m.marketCap),
          },
        })
        .catch(() => null)
    })
  )
}

/** Cada cuánto se revisan los holders de un token. */
const HOLDERS_EVERY_MS = 30 * 60_000
/** Tokens revisados por pasada, y pausa entre ellos (límite de GeckoTerminal). */
const HOLDERS_BATCH = 4
const HOLDERS_GAP_MS = 2500
const holdersCheckedAt = new Map<string, number>()

/**
 * Holders y % del top 10 (GeckoTerminal). Nadie los rellenaba: todos los
 * tokens salían con 0 holders y un top 10 inventado del 25%. Una petición por
 * token, así que cada pasada revisa unos pocos, empezando por los que llevan
 * más tiempo sin revisar (o nunca revisados).
 */
async function refreshHolders(): Promise<void> {
  const now = Date.now()
  const tokens = await db.token.findMany({
    where: { contract: { not: '' } },
    select: { id: true, network: true, contract: true },
  })
  const due = tokens
    .filter((t) => now - (holdersCheckedAt.get(t.id) ?? 0) >= HOLDERS_EVERY_MS)
    .sort((a, b) => (holdersCheckedAt.get(a.id) ?? 0) - (holdersCheckedAt.get(b.id) ?? 0))
    .slice(0, HOLDERS_BATCH)
  for (const [i, t] of due.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, HOLDERS_GAP_MS))
    const h = await fetchHolders(t.network, t.contract).catch(() => null)
    // Si falla (límite, red sin datos) se reintenta en la próxima pasada
    if (!h) continue
    holdersCheckedAt.set(t.id, Date.now())
    const data: { holders?: number; top10Pct?: number } = {}
    if (h.count !== null) data.holders = h.count
    if (h.top10Pct !== null) data.top10Pct = Math.round(h.top10Pct * 10) / 10
    if (Object.keys(data).length) await db.token.update({ where: { id: t.id }, data }).catch(() => null)
  }
}

/**
 * Deja la pestaña Tokens al día. Barato si se ha hecho en el último minuto; si
 * no, sincroniza, pero la petición que lo dispara solo espera unos segundos.
 * Si tarda más, esa respuesta sale con los datos anteriores y la siguiente ya
 * trae los nuevos.
 */
export async function ensureTokensFresh(): Promise<void> {
  if (!running && Date.now() - lastRun < EVERY_MS) return
  if (!running) {
    lastRun = Date.now()
    running = (async () => {
      try {
        await syncLaunchedTokens()
        await refreshMarket()
        await refreshHolders()
      } catch {
        // Nunca debe tumbar la pestaña: se reintentará en la siguiente pasada
      } finally {
        running = null
      }
    })()
  }
  await Promise.race([running, new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS))])
}
