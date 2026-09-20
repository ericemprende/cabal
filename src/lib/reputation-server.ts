import { db } from '@/lib/db'
import { repScore, type RepValue } from '@/lib/reputation'

/**
 * Parte de la reputación que toca la base de datos. Separada de
 * lib/reputation.ts porque aquella la importan también los componentes de
 * cliente, que no pueden arrastrar Prisma.
 */

/**
 * Quién puede valorar a alguien. Valorar es un perk del plan Premium: la
 * reputación de una persona pesa mucho aquí, así que solo opina quien tiene la
 * piel en el juego (y una cuenta que cuesta dinero reponer si la queman).
 * Encima se pide alguna verificación (wallet firmada, X, Google o correo).
 * Nadie se vota a sí mismo.
 */
export type RepEligibility = 'ok' | 'anon' | 'self' | 'unverified' | 'premium'

export function repEligibility(
  viewer:
    | { id: string; walletVerified: boolean; xVerified: boolean; googleVerified: boolean; emailVerified: boolean }
    | null,
  targetId: string,
  /** Suscripción activa (o admin). Ver hasPremium en lib/premium.ts. */
  premium: boolean
): RepEligibility {
  if (!viewer) return 'anon'
  if (viewer.id === targetId) return 'self'
  if (!premium) return 'premium'
  const verified = viewer.walletVerified || viewer.xVerified || viewer.googleVerified || viewer.emailVerified
  return verified ? 'ok' : 'unverified'
}

/**
 * Recalcula el resumen guardado en el usuario a partir de sus valoraciones y
 * lo devuelve. Se llama después de cada voto: son dos agregados sobre un
 * índice, y así cualquier lista puede enseñar la insignia sin recontar.
 */
export async function recomputeReputation(targetId: string) {
  const rows = await db.reputation.groupBy({
    by: ['value'],
    where: { targetId, hidden: false },
    _count: { _all: true },
    _sum: { weight: true },
  })

  const pick = (value: RepValue) => rows.find((r) => r.value === value)
  const up = pick(1)?._count._all ?? 0
  const down = pick(-1)?._count._all ?? 0
  const score = repScore(pick(1)?._sum.weight ?? 0, pick(-1)?._sum.weight ?? 0)

  await db.user.update({ where: { id: targetId }, data: { repUp: up, repDown: down, repScore: score } })
  return { score, up, down, votes: up + down }
}
