import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { isAdminRequest } from '@/lib/admin-auth'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { invalidate } from '@/lib/cache'

// ---------- POINTS ENGINE ----------
export const POINT_RULE_KEYS = [
  'points_thesis',
  'points_comment',
  'points_launch',
  'points_like_received',
  'points_hype_received',
  'points_daily_visit',
  'points_referral_percent',
  'points_share_x',
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
  | 'verify_wallet'
  | 'referral'
  | 'share_x'

const REASON_TO_KEY: Record<string, string> = {
  thesis: 'points_thesis',
  comment: 'points_comment',
  launch: 'points_launch',
  like_received: 'points_like_received',
  hype_received: 'points_hype_received',
  daily_visit: 'points_daily_visit',
  share_x: 'points_share_x',
}

export async function getPointRules(): Promise<Record<string, number>> {
  const settings = await db.setting.findMany({ where: { key: { startsWith: 'points_' } } })
  const rules: Record<string, number> = {}
  for (const s of settings) rules[s.key] = parseInt(s.value, 10) || 0
  return rules
}

/** Porcentaje de referidos (Setting points_referral_percent, default 10). */
export async function getReferralPercent(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: 'points_referral_percent' } })
  const pct = s ? parseInt(s.value, 10) : 10
  return Number.isFinite(pct) && pct > 0 ? pct : 10
}

/**
 * Awards points to a user according to the configured rule. Returns points awarded (0 if rule = 0).
 * Si el usuario fue invitado por alguien (referido), el invitador gana el
 * points_referral_percent% de estos puntos (no se propaga en cascada).
 */
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

  // Los puntos acaban de cambiar: la tabla cacheada del leaderboard ya no vale.
  await invalidate('leaderboard:*')

  // ── Referidos: el que invitó gana el % configurado ──
  if (reason !== 'referral' && amount > 0) {
    try {
      const earner = await db.user.findUnique({ where: { id: userId }, select: { referredById: true } })
      if (earner?.referredById) {
        const pct = await getReferralPercent()
        const bonus = Math.floor((amount * pct) / 100)
        if (bonus > 0) {
          await awardPoints(earner.referredById, 'referral', note ? `${pct}% referido · ${note}` : `${pct}% de puntos de tu invitado`, bonus)
        }
      }
    } catch {
      /* el bonus de referido nunca rompe el otorgamiento principal */
    }
  }
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
  // 1) Si hay sesión de usuario (cookie), esa es la cuenta activa
  const sessionUserId = await sessionUserIdFromCookies()
  if (sessionUserId) {
    const sessionUser = await db.user.findUnique({ where: { id: sessionUserId } })
    if (sessionUser) return sessionUser
  }
  // 2) Modo invitado: el usuario demo de la app
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
