import { PublicKey } from '@solana/web3.js'
import { db } from '@/lib/db'
import { solanaConnection } from '@/lib/swap'
import { cached } from '@/lib/cache'
import { REP_MIN_VOTES } from '@/lib/reputation'
import type { BadgeDTO, BadgeMetal } from '@/lib/types'

/**
 * Emblemas del perfil: insignias por hitos (fundador, actividad…), no por
 * suscripción. El Premium se enseña aparte con la coronita (ver lib/premium).
 *
 * Una silueta por familia y el metal diciendo cuánto: bronce al estrenarse,
 * obsidiana al otro extremo. Antes eran nueve entradas planas y un mapa aparte
 * para que no salieran dos de la misma familia; ahora la familia ya es la
 * insignia y solo hay que quedarse con el corte más alto que se cumpla.
 *
 * Hay dos maneras de subir. Las que CUENTAN premian constancia (lanzamientos,
 * tesis, hype repartido). Las que MIDEN premian acierto, y por eso piden un
 * mínimo de intentos: con dos calls acertadas de dos no se es francotirador.
 *
 * Se calcula al vuelo con datos que ya existen; solo el corte de "fundador" se
 * cachea, para no contar la tabla de usuarios en cada perfil que se abre.
 */

const FOUNDER_LIMIT = 500

export type BadgeContext = {
  createdAt: Date
  isDev: boolean
  walletVerified: boolean
  isFounder: boolean
  stats: {
    launchesCount: number
    thesesCount: number
    postsCount: number
    likesReceived: number
    hypesGiven: number
    /** Dólares operados con el botón de compra/venta de Cabal (trades confirmados). */
    tradeVolumeUsd?: number
    /** Dólares donados a Cabal (donaciones confirmadas). Ver lib/donate-server. */
    donatedUsd?: number
    /** SKR (el token de Solana Mobile) en sus wallets de Solana verificadas. Ver skrHeld. */
    skrHeld?: number
  }
  /** Resultados de sus calls. Ver lib/call-score. */
  calls: {
    /** Calls con resultado que llegaron a 1.5X o más. */
    won: number
    /** Calls ya evaluadas. Las que aún no tienen pico no cuentan. */
    total: number
    /** El pico más alto que alcanzó una call suya, en X. */
    best: number | null
  }
  /** Lo que la comunidad dice de él. Ver lib/reputation. */
  rep: { score: number; votes: number }
}

type Rango = {
  /** El corte, ya resuelto: true si esta cuenta lo alcanza. */
  cumple: (c: BadgeContext) => boolean
  metal: BadgeMetal
  label: string
  description: string
}

type Familia = {
  id: string
  silueta: string
  /** De menor a mayor: gana el último que se cumpla. */
  rangos: Rango[]
}

const FAMILIAS: Familia[] = [
  {
    // Seeker: premia a quien tiene SKR, el token del ecosistema Solana Mobile.
    // Se lee on-chain de las wallets verificadas (firmadas), no de lo que diga
    // el usuario, así que no se puede presumir del SKR de otro.
    id: 'skr',
    silueta: 'radar-sweep',
    rangos: [
      { cumple: (c) => (c.stats.skrHeld ?? 0) >= 1, metal: 'bronce', label: 'Seeker', description: 'Tiene SKR, el token de Solana Mobile, en su wallet verificada' },
      { cumple: (c) => (c.stats.skrHeld ?? 0) >= 1_000, metal: 'acero', label: 'Seeker veterano', description: 'Tiene 1.000 SKR o más en su wallet verificada' },
      { cumple: (c) => (c.stats.skrHeld ?? 0) >= 10_000, metal: 'oro', label: 'Guardián Seeker', description: 'Tiene 10.000 SKR o más en su wallet verificada' },
      { cumple: (c) => (c.stats.skrHeld ?? 0) >= 100_000, metal: 'obsidiana', label: 'Leyenda Seeker', description: 'Tiene 100.000 SKR o más en su wallet verificada' },
    ],
  },
  {
    // Donador: la primera es blanca y no la de bronce, porque donar un dólar ya
    // es de presumir. Luego sube como las demás: no es lo mismo $1 que $1.000.
    id: 'donor',
    silueta: 'cherish',
    rangos: [
      { cumple: (c) => (c.stats.donatedUsd ?? 0) >= 1, metal: 'blanco', label: 'Donador', description: 'Donó a Cabal para mantenerlo gratis' },
      { cumple: (c) => (c.stats.donatedUsd ?? 0) >= 25, metal: 'acero', label: 'Aliado', description: 'Donó $25 o más a Cabal' },
      { cumple: (c) => (c.stats.donatedUsd ?? 0) >= 100, metal: 'oro', label: 'Mecenas', description: 'Donó $100 o más a Cabal' },
      { cumple: (c) => (c.stats.donatedUsd ?? 0) >= 1_000, metal: 'obsidiana', label: 'Benefactor', description: 'Donó $1.000 o más a Cabal' },
    ],
  },
  {
    id: 'launches',
    silueta: 'rocket',
    rangos: [
      { cumple: (c) => c.stats.launchesCount >= 1, metal: 'bronce', label: 'Primer Launch', description: 'Publicó su primer lanzamiento en el Radar' },
      { cumple: (c) => c.stats.launchesCount >= 10, metal: 'acero', label: 'Serial Launcher', description: 'Publicó 10 lanzamientos o más' },
      { cumple: (c) => c.stats.launchesCount >= 50, metal: 'oro', label: 'Leyenda del Radar', description: 'Publicó 50 lanzamientos o más' },
      { cumple: (c) => c.stats.launchesCount >= 250, metal: 'obsidiana', label: 'Comandante', description: 'Publicó 250 lanzamientos o más' },
    ],
  },
  {
    id: 'theses',
    silueta: 'scroll-unfurled',
    rangos: [
      { cumple: (c) => c.stats.thesesCount >= 10, metal: 'bronce', label: 'Analista', description: 'Escribió 10 tesis o más' },
      { cumple: (c) => c.stats.thesesCount >= 50, metal: 'acero', label: 'Oráculo', description: 'Escribió 50 tesis o más' },
      { cumple: (c) => c.stats.thesesCount >= 200, metal: 'oro', label: 'Vidente', description: 'Escribió 200 tesis o más' },
      { cumple: (c) => c.stats.thesesCount >= 500, metal: 'obsidiana', label: 'Profeta', description: 'Escribió 500 tesis o más' },
    ],
  },
  {
    id: 'aim',
    silueta: 'dead-eye',
    rangos: [
      { cumple: (c) => acierto(c, 10, 40), metal: 'bronce', label: 'Tirador', description: 'Acierta el 40% de sus calls, con 10 o más evaluadas' },
      { cumple: (c) => acierto(c, 25, 50), metal: 'acero', label: 'Tirador selecto', description: 'Acierta el 50% de sus calls, con 25 o más evaluadas' },
      { cumple: (c) => acierto(c, 50, 60), metal: 'oro', label: 'Francotirador', description: 'Acierta el 60% de sus calls, con 50 o más evaluadas' },
      { cumple: (c) => acierto(c, 100, 70), metal: 'obsidiana', label: 'Ojo de halcón', description: 'Acierta el 70% de sus calls, con 100 o más evaluadas' },
    ],
  },
  {
    id: 'best-call',
    silueta: 'impact-point',
    rangos: [
      { cumple: (c) => (c.calls.best ?? 0) >= 2, metal: 'bronce', label: 'Diana', description: 'Una de sus calls llegó a 2X' },
      { cumple: (c) => (c.calls.best ?? 0) >= 5, metal: 'acero', label: 'Impacto directo', description: 'Una de sus calls llegó a 5X' },
      { cumple: (c) => (c.calls.best ?? 0) >= 10, metal: 'oro', label: 'Derribo', description: 'Una de sus calls llegó a 10X' },
      { cumple: (c) => (c.calls.best ?? 0) >= 50, metal: 'obsidiana', label: 'Aniquilación', description: 'Una de sus calls llegó a 50X' },
    ],
  },
  {
    id: 'hype',
    silueta: 'flame',
    rangos: [
      { cumple: (c) => c.stats.hypesGiven >= 100, metal: 'bronce', label: 'Hypeman', description: 'Dio hype a 100 lanzamientos o más' },
      { cumple: (c) => c.stats.hypesGiven >= 500, metal: 'acero', label: 'Pirómano', description: 'Dio hype a 500 lanzamientos o más' },
      { cumple: (c) => c.stats.hypesGiven >= 2000, metal: 'oro', label: 'Incendiario', description: 'Dio hype a 2.000 lanzamientos o más' },
      { cumple: (c) => c.stats.hypesGiven >= 10000, metal: 'obsidiana', label: 'Lanzallamas', description: 'Dio hype a 10.000 lanzamientos o más' },
    ],
  },
  {
    id: 'reach',
    silueta: 'megaphone',
    rangos: [
      { cumple: (c) => c.stats.likesReceived >= 100, metal: 'bronce', label: 'Popular', description: 'Sus posts recibieron 100 me gusta o más' },
      { cumple: (c) => c.stats.likesReceived >= 500, metal: 'acero', label: 'Viral', description: 'Sus posts recibieron 500 me gusta o más' },
      { cumple: (c) => c.stats.likesReceived >= 2000, metal: 'oro', label: 'Altavoz', description: 'Sus posts recibieron 2.000 me gusta o más' },
      { cumple: (c) => c.stats.likesReceived >= 10000, metal: 'obsidiana', label: 'Ídolo', description: 'Sus posts recibieron 10.000 me gusta o más' },
    ],
  },
  {
    id: 'volume',
    silueta: 'candles',
    rangos: [
      { cumple: (c) => (c.stats.tradeVolumeUsd ?? 0) >= 1_000, metal: 'bronce', label: 'Escaramuza', description: 'Operó $1.000 o más desde Cabal' },
      { cumple: (c) => (c.stats.tradeVolumeUsd ?? 0) >= 25_000, metal: 'acero', label: 'Asalto', description: 'Operó $25.000 o más desde Cabal' },
      { cumple: (c) => (c.stats.tradeVolumeUsd ?? 0) >= 250_000, metal: 'oro', label: 'Ofensiva', description: 'Operó $250.000 o más desde Cabal' },
      { cumple: (c) => (c.stats.tradeVolumeUsd ?? 0) >= 2_500_000, metal: 'obsidiana', label: 'Guerra total', description: 'Operó $2.500.000 o más desde Cabal' },
    ],
  },
  {
    id: 'trust',
    silueta: 'checked-shield',
    rangos: [
      { cumple: (c) => c.isDev && c.walletVerified, metal: 'bronce', label: 'Dev verificado', description: 'Marcado como dev y con su wallet verificada' },
      { cumple: (c) => confianza(c, REP_MIN_VOTES, 70), metal: 'acero', label: 'Dev confiable', description: 'La comunidad le da un 70% de confianza o más' },
      { cumple: (c) => confianza(c, 10, 85), metal: 'oro', label: 'Dev muy confiable', description: 'Un 85% de confianza con 10 valoraciones o más' },
      { cumple: (c) => confianza(c, 30, 85), metal: 'obsidiana', label: 'Dev de élite', description: 'Un 85% de confianza con 30 valoraciones o más' },
    ],
  },
]

/** Puntería: porcentaje de aciertos, pero solo con bastantes calls detrás. */
function acierto(c: BadgeContext, minimo: number, pct: number): boolean {
  if (c.calls.total < minimo) return false
  return (c.calls.won * 100) / c.calls.total >= pct
}

/** Confianza: hace falta ser dev verificado y tener valoraciones suficientes. */
function confianza(c: BadgeContext, minVotos: number, pct: number): boolean {
  if (!c.isDev || !c.walletVerified) return false
  return c.rep.votes >= minVotos && c.rep.score >= pct
}

/**
 * Fundador no es un rango: o se estuvo en las primeras cuentas o no. Por eso no
 * usa ninguno de los cuatro metales y lleva el verde de la marca.
 */
const FUNDADOR: BadgeDTO = {
  id: 'founder',
  label: 'Fundador',
  description: `Una de las primeras ${FOUNDER_LIMIT} cuentas del Cabal`,
  icon: 'ribbon-medal',
  silueta: 'ribbon-medal',
  metal: 'fundador',
  rango: 0,
}

/** El orden es el de la vitrina: primero lo más difícil de conseguir. */
export function computeBadges(ctx: BadgeContext): BadgeDTO[] {
  const out: BadgeDTO[] = []
  if (ctx.isFounder) out.push(FUNDADOR)

  for (const fam of FAMILIAS) {
    // De mayor a menor: el primero que se cumpla es el rango de esta cuenta
    for (let i = fam.rangos.length - 1; i >= 0; i--) {
      const r = fam.rangos[i]
      if (!r.cumple(ctx)) continue
      out.push({
        id: `${fam.id}-${i + 1}`,
        label: r.label,
        description: r.description,
        icon: fam.silueta,
        silueta: fam.silueta,
        metal: r.metal,
        rango: i + 1,
      })
      break
    }
  }

  // Obsidiana primero, bronce al final; Fundador siempre abre
  const peso: Record<BadgeMetal, number> = { obsidiana: 4, oro: 3, acero: 2, bronce: 1, verde: 0, fundador: 5, blanco: 1 }
  return out.sort((a, b) => peso[b.metal] - peso[a.metal])
}

/**
 * La insignia de donador que corresponde a un total donado, o null si aún no
 * llega a la primera. La enseña la pantalla de gracias de una donación.
 */
export function donorBadge(usd: number): BadgeDTO | null {
  const fam = FAMILIAS.find((f) => f.id === 'donor')
  if (!fam) return null
  const ctx = { stats: { donatedUsd: usd } } as BadgeContext
  for (let i = fam.rangos.length - 1; i >= 0; i--) {
    const r = fam.rangos[i]
    if (!r.cumple(ctx)) continue
    return { id: `${fam.id}-${i + 1}`, label: r.label, description: r.description, icon: fam.silueta, silueta: fam.silueta, metal: r.metal, rango: i + 1 }
  }
  return null
}

/**
 * Volumen operado desde Cabal: la suma en USD de los swaps confirmados de sus
 * wallets vinculadas, valorados al ejecutarse. Cacheado 5 minutos.
 */
export async function tradeVolumeUsd(userId: string): Promise<number> {
  return cached(`badges:volume:${userId}`, 300, async () => {
    const links = await db.walletLink.findMany({ where: { userId }, select: { network: true, address: true } })
    if (links.length === 0) return 0
    const agg = await db.swapIntent.aggregate({
      where: { consumed: true, OR: links.map((l) => ({ network: l.network, walletAddress: l.address })) },
      _sum: { amountUsd: true },
    })
    return agg._sum.amountUsd ?? 0
  })
}

/** Mint oficial de SKR (https://solanamobile.com/skr). */
export const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'

/**
 * SKR que tiene en sus wallets de Solana verificadas, sumado y en unidades
 * legibles. Cacheado 10 minutos: es una consulta al RPC por wallet. Si el RPC
 * falla, cuenta 0 en vez de romper el perfil.
 */
export async function skrHeld(userId: string): Promise<number> {
  return cached(`badges:skr:${userId}`, 600, async () => {
    const links = await db.walletLink.findMany({
      where: { userId, network: 'solana', signature: true },
      select: { address: true },
    })
    if (links.length === 0) return 0
    const conn = solanaConnection()
    const mint = new PublicKey(SKR_MINT)
    let total = 0
    for (const { address } of links) {
      try {
        const res = await conn.getParsedTokenAccountsByOwner(new PublicKey(address), { mint })
        for (const { account } of res.value) total += Number(account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0)
      } catch {
        // una dirección rara o un RPC caído no tumba el perfil
      }
    }
    return total
  })
}

/** Dólares donados y confirmados. Cacheado 5 minutos, como el volumen. */
export async function donatedUsd(userId: string): Promise<number> {
  return cached(`badges:donated:${userId}`, 300, async () => {
    const agg = await db.donation.aggregate({ where: { userId }, _sum: { amountUsd: true } })
    return agg._sum.amountUsd ?? 0
  })
}

/**
 * El siguiente rango de cada familia que aún no tiene: lo que le falta para
 * subir. Se enseña en la vitrina como objetivo apagado, para que siempre haya
 * algo a la vista por lo que volver.
 */
export function computeNextBadges(ctx: BadgeContext): BadgeDTO[] {
  const out: BadgeDTO[] = []
  for (const fam of FAMILIAS) {
    const i = fam.rangos.findIndex((r) => !r.cumple(ctx))
    if (i === -1) continue
    const r = fam.rangos[i]
    out.push({
      id: `${fam.id}-${i + 1}`,
      label: r.label,
      description: r.description,
      icon: fam.silueta,
      silueta: fam.silueta,
      metal: r.metal,
      rango: i + 1,
    })
  }
  return out
}

/**
 * Fecha de alta de la cuenta número 500 (o null si el Cabal todavía no ha
 * llegado a 500 cuentas: entonces todo el mundo es fundador). Cacheado una
 * hora: en cuanto se supera el corte, ya no cambia nunca más.
 */
async function founderCutoff(): Promise<string | null> {
  return cached('badges:founder-cutoff', 3600, async () => {
    const nth = await db.user.findMany({
      orderBy: { createdAt: 'asc' },
      skip: FOUNDER_LIMIT - 1,
      take: 1,
      select: { createdAt: true },
    })
    return nth[0]?.createdAt.toISOString() ?? null
  })
}

export async function isFounder(createdAt: Date): Promise<boolean> {
  const cutoff = await founderCutoff()
  return cutoff === null || createdAt.getTime() <= new Date(cutoff).getTime()
}
