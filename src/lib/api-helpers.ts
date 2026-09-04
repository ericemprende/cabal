import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { isAdminRequest } from '@/lib/admin-auth'

// ---------- POINTS ENGINE ----------
export const POINT_RULE_KEYS = [
  'points_thesis',
  'points_comment',
  'points_launch',
  'points_like_received',
  'points_hype_received',
  'points_daily_visit',
] as const

export type PointReason =
  | 'thesis'
  | 'comment'
  | 'launch'
  | 'like_received'
  | 'hype_received'
  | 'daily_visit'
  | 'admin_adjust'
  | 'redeem'
  | 'verify_x'
  | 'verify_google'

const REASON_TO_KEY: Record<string, string> = {
  thesis: 'points_thesis',
  comment: 'points_comment',
  launch: 'points_launch',
  like_received: 'points_like_received',
  hype_received: 'points_hype_received',
  daily_visit: 'points_daily_visit',
}

export async function getPointRules(): Promise<Record<string, number>> {
  const settings = await db.setting.findMany({ where: { key: { startsWith: 'points_' } } })
  const rules: Record<string, number> = {}
  for (const s of settings) rules[s.key] = parseInt(s.value, 10) || 0
  return rules
}

/** Awards points to a user according to the configured rule. Returns points awarded (0 if rule = 0). */
export async function awardPoints(
  userId: string,
  reason: PointReason,
  note?: string,
  customAmount?: number
): Promise<number> {
  const amount =
    customAmount ??
    (REASON_TO_KEY[reason] ? (await getPointRules())[REASON_TO_KEY[reason]] ?? 0 : 0)
  if (amount === 0) return 0
  await db.$transaction([
    db.pointEvent.create({ data: { userId, amount, reason, note } }),
    db.user.update({
      where: { id: userId },
      data: {
        points: { increment: amount },
        lifetimePoints: { increment: Math.max(amount, 0) },
      },
    }),
  ])
  return amount
}

export async function requireAdmin(req?: Request) {
  const me = await getCurrentUser()
  // Acceso si el usuario actual es admin O si trae la cookie de sesión de /admin
  if (me.isAdmin || (req && isAdminRequest(req))) return me
  throw new ForbiddenError()
}

export class ForbiddenError extends Error {
  constructor() {
    super('Admin access required')
  }
}

export async function getCurrentUser() {
  await ensureSeeded()
  const user = await db.user.findFirst({ where: { isCurrentUser: true } })
  if (!user) throw new Error('No current user')
  return user
}

export async function getUserVotes(userId: string) {
  const votes = await db.vote.findMany({ where: { userId } })
  return {
    launchHypes: new Set(votes.filter((v) => v.target === 'launch').map((v) => v.targetId)),
    postLikes: new Set(votes.filter((v) => v.target === 'post').map((v) => v.targetId)),
  }
}

export async function getFollowedIds(userId: string) {
  const follows = await db.follow.findMany({ where: { userId } })
  return new Set(follows.map((f) => f.targetId))
}

export function computeLaunchStatus(launchAt: Date): string {
  const diff = launchAt.getTime() - Date.now()
  if (diff > 0) return 'upcoming'
  if (-diff <= 48 * 3600_000) return 'live'
  return 'ended'
}

// Deterministic pseudo-random generator from a string seed
export function seededRandom(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return function next(): number {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 100000) / 100000
  }
}

// Generate synthetic price history ending at current price
export function generateChart(
  tokenId: string,
  currentMc: number,
  change24h: number,
  isRug: boolean
): { t: number; p: number }[] {
  const rnd = seededRandom(tokenId)
  const points = 120
  const now = Date.now()
  const arr: { t: number; p: number }[] = []

  // Start price: derive so that final change roughly matches change24h over the last chunk
  const drift = isRug ? -3.2 : change24h / 100
  let mc = currentMc / (1 + drift * 0.35)
  const min = Math.max(currentMc * 0.03, 8000)

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1)
    // random walk + trend towards current price
    const noise = (rnd() - 0.48) * 0.06
    const trend = drift * (0.0035 + progress * 0.004)
    mc = mc * (1 + noise + trend)
    if (mc < min) mc = min * (1 + rnd() * 0.5)
    // spike structure: occasional pumps
    if (rnd() > 0.985) mc = mc * (1 + rnd() * 0.12)
    if (rnd() > 0.99) mc = mc * (1 - rnd() * 0.1)
    arr.push({ t: now - (points - 1 - i) * 30 * 60_000, p: mc })
  }
  // force last point to current
  arr[arr.length - 1].p = currentMc
  return arr.map((d) => ({ t: d.t, p: Math.round(d.p) }))
}
