import { db } from '@/lib/db'
import { cached } from '@/lib/cache'
import type { BadgeDTO } from '@/lib/types'

/**
 * Emblemas del perfil: insignias por hitos (fundador, actividad…), no por
 * suscripción. El Premium se enseña aparte con la coronita (ver lib/premium).
 *
 * Se calculan al vuelo a partir de datos que ya existen (nada que sincronizar
 * ni que se pueda desincronizar); solo el corte de "fundador" se cachea, para
 * no contar la tabla de usuarios en cada perfil que se abre.
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
  }
}

type BadgeDef = BadgeDTO & { check: (ctx: BadgeContext) => boolean }

/**
 * Orden = el orden en que se enseñan: primero lo más difícil de conseguir.
 * Añadir un emblema nuevo es añadir una entrada aquí.
 */
const BADGE_DEFS: BadgeDef[] = [
  {
    id: 'founder',
    label: 'Fundador',
    description: `Una de las primeras ${FOUNDER_LIMIT} cuentas del Cabal`,
    icon: 'gem',
    check: (c) => c.isFounder,
  },
  {
    id: 'verified_dev',
    label: 'Dev verificado',
    description: 'Marcado como dev y con su wallet verificada',
    icon: 'shield-check',
    check: (c) => c.isDev && c.walletVerified,
  },
  {
    id: 'launch_50',
    label: 'Leyenda del Radar',
    description: 'Publicó 50 lanzamientos o más',
    icon: 'flame',
    check: (c) => c.stats.launchesCount >= 50,
  },
  {
    id: 'launch_10',
    label: 'Serial Launcher',
    description: 'Publicó 10 lanzamientos o más',
    icon: 'rocket',
    check: (c) => c.stats.launchesCount >= 10,
  },
  {
    id: 'first_launch',
    label: 'Primer Launch',
    description: 'Publicó su primer lanzamiento en el Radar',
    icon: 'rocket',
    check: (c) => c.stats.launchesCount >= 1,
  },
  {
    id: 'thesis_50',
    label: 'Oráculo',
    description: 'Escribió 50 tesis o más',
    icon: 'graduation-cap',
    check: (c) => c.stats.thesesCount >= 50,
  },
  {
    id: 'thesis_10',
    label: 'Analista',
    description: 'Escribió 10 tesis o más',
    icon: 'graduation-cap',
    check: (c) => c.stats.thesesCount >= 10,
  },
  {
    id: 'popular',
    label: 'Popular',
    description: 'Sus posts recibieron 100 likes o más',
    icon: 'heart',
    check: (c) => c.stats.likesReceived >= 100,
  },
  {
    id: 'hypeman',
    label: 'Hypeman',
    description: 'Dio hype a 100 lanzamientos o más',
    icon: 'zap',
    check: (c) => c.stats.hypesGiven >= 100,
  },
]

/**
 * Solo un emblema por "familia" (p. ej. no enseñar Serial Launcher junto a
 * Primer Launch): se queda el primero que aparezca en BADGE_DEFS, que ya
 * están en orden de más a menos difícil.
 */
const FAMILY: Record<string, string> = {
  launch_50: 'launch',
  launch_10: 'launch',
  first_launch: 'launch',
  thesis_50: 'thesis',
  thesis_10: 'thesis',
}

export function computeBadges(ctx: BadgeContext): BadgeDTO[] {
  const seen = new Set<string>()
  const out: BadgeDTO[] = []
  for (const def of BADGE_DEFS) {
    const family = FAMILY[def.id]
    if (family && seen.has(family)) continue
    if (!def.check(ctx)) continue
    if (family) seen.add(family)
    out.push({ id: def.id, label: def.label, description: def.description, icon: def.icon })
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
