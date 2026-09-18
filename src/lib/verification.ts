import { db } from '@/lib/db'
import { premiumUserIdsAmong } from '@/lib/premium'
import { invalidate } from '@/lib/cache'
import type { VerifyRequestDTO } from '@/lib/types'

/**
 * Verificación oficial de Cabal: la insignia de perfiles, launches y tokens
 * frente a clones. La da el admin directamente ("admin", permanente) o al
 * aprobar la solicitud de un usuario Premium ("premium"): esa dura lo que dure
 * su Premium, y syncPremiumVerifications la apaga o la vuelve a encender.
 */

export type VerifyVia = 'admin' | 'premium'

/**
 * Enciende o apaga las verificaciones "premium" según el Premium de su dueño.
 * La llama el worker en cada pasada: son dos consultas pequeñas.
 */
export async function syncPremiumVerifications(): Promise<number> {
  const [users, launches] = await Promise.all([
    db.user.findMany({ where: { verifiedVia: 'premium' }, select: { id: true, verified: true } }),
    db.launch.findMany({ where: { verifiedVia: 'premium' }, select: { id: true, verified: true, createdById: true } }),
  ])
  if (users.length === 0 && launches.length === 0) return 0
  const premium = await premiumUserIdsAmong([...new Set([...users.map((u) => u.id), ...launches.map((l) => l.createdById)])])

  const flip = <T extends { id: string; verified: boolean }>(rows: T[], owner: (r: T) => string) => ({
    on: rows.filter((r) => !r.verified && premium.has(owner(r))).map((r) => r.id),
    off: rows.filter((r) => r.verified && !premium.has(owner(r))).map((r) => r.id),
  })
  const u = flip(users, (r) => r.id)
  const l = flip(launches, (r) => r.createdById)
  const ops = [
    u.on.length && db.user.updateMany({ where: { id: { in: u.on } }, data: { verified: true } }),
    u.off.length && db.user.updateMany({ where: { id: { in: u.off } }, data: { verified: false } }),
    l.on.length && db.launch.updateMany({ where: { id: { in: l.on } }, data: { verified: true } }),
    l.off.length && db.launch.updateMany({ where: { id: { in: l.off } }, data: { verified: false } }),
  ].filter(Boolean)
  if (ops.length === 0) return 0
  await Promise.all(ops)
  if (l.on.length || l.off.length) await invalidate('launches:*')
  return u.on.length + u.off.length + l.on.length + l.off.length
}

export function serializeVerifyRequest(r: {
  id: string
  kind: string
  note: string
  status: string
  createdAt: Date
  reviewedAt: Date | null
  launch?: { id: string; name: string; ticker: string | null } | null
  user?: { id: string; handle: string; name: string; avatar: string } | null
}): VerifyRequestDTO {
  return {
    id: r.id,
    kind: r.kind === 'launch' ? 'launch' : 'user',
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    launch: r.launch ?? null,
    user: r.user ?? null,
  }
}
