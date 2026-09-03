import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'

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
