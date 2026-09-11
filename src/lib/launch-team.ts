import { db } from '@/lib/db'
import { toPublicUserDTO } from '@/lib/serializers'
import type { LaunchMemberDTO } from '@/lib/types'

/**
 * Equipos por launch: el dev invita a otros usuarios con un rol. Para añadir un
 * rol basta con sumarlo aquí.
 */
export const LAUNCH_ROLES = {
  programador: 'Programador',
  team: 'Team',
  moderador: 'Moderador',
} as const

export type LaunchRole = keyof typeof LAUNCH_ROLES

export function isLaunchRole(v: unknown): v is LaunchRole {
  return typeof v === 'string' && v in LAUNCH_ROLES
}

export function roleLabel(role: string): string {
  return isLaunchRole(role) ? LAUNCH_ROLES[role] : role
}

/** Tope de miembros por launch (invitaciones pendientes incluidas). */
export const MAX_TEAM_SIZE = 30

/**
 * Quién gestiona el equipo: el dev que publicó el launch o quien lo reclamó y
 * se verificó on-chain. Un scout que solo compartió la info no es el dev del
 * proyecto, así que no puede montar su equipo. Los admins, además, siempre.
 */
export async function teamManagerIds(launch: {
  id: string
  createdById: string
  submitterRole: string
}): Promise<Set<string>> {
  const ids = new Set<string>()
  if (launch.submitterRole === 'dev') ids.add(launch.createdById)
  const claims = await db.projectClaim.findMany({
    where: { targetType: 'launch', targetId: launch.id, status: 'verified' },
    select: { userId: true },
  })
  for (const c of claims) ids.add(c.userId)
  return ids
}

type MemberRow = Parameters<typeof toPublicUserDTO>[0]

export function toMemberDTO(m: {
  id: string
  role: string
  status: string
  createdAt: Date
  user: MemberRow
}): LaunchMemberDTO {
  return {
    id: m.id,
    role: m.role,
    roleLabel: roleLabel(m.role),
    status: m.status,
    user: toPublicUserDTO(m.user),
    createdAt: m.createdAt.toISOString(),
  }
}
