import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { isAdminRequest } from '@/lib/admin-auth'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { invalidate } from '@/lib/cache'
import { launchPhase } from '@/lib/cabal'

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
  'points_follow_x',
  'points_share_follow_x',
  'points_verify_discord',
  'points_verify_telegram',
  'points_swap_referral_pct',
  'points_per_usd_fee',
  'points_trade_cashback_pct',
  'points_per_usd_donated',
  'points_share_donation',
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
  | 'verify_discord'
  | 'verify_telegram'
  | 'verify_wallet'
  | 'referral'
  | 'share_x'
  | 'follow_x'
  | 'share_follow_x'
  | 'swap_referral'
  | 'trade_cashback'
  | 'donation'
  | 'share_donation'

const REASON_TO_KEY: Record<string, string> = {
  thesis: 'points_thesis',
  comment: 'points_comment',
  launch: 'points_launch',
  like_received: 'points_like_received',
  hype_received: 'points_hype_received',
  daily_visit: 'points_daily_visit',
  share_x: 'points_share_x',
  follow_x: 'points_follow_x',
  share_follow_x: 'points_share_follow_x',
  verify_discord: 'points_verify_discord',
  verify_telegram: 'points_verify_telegram',
  // 'donation' no está aquí: sus puntos salen del importe donado, no de una
  // regla fija (ver lib/donate.ts).
  share_donation: 'points_share_donation',
}

// Valores por defecto si la Setting no existe en la BD. El seed solo las crea
// en una BD vacía, así que sin esto una regla ausente valía 0 y no se daban
// puntos (pasó con points_launch en producción).
const POINT_RULE_DEFAULTS: Record<string, number> = {
  points_thesis: 25,
  points_comment: 5,
  points_launch: 40,
  points_like_received: 2,
  points_hype_received: 1,
  points_daily_visit: 3,
  points_share_x: 10,
  points_follow_x: 15,
  points_share_follow_x: 10,
  points_verify_discord: 10,
  points_verify_telegram: 10,
  // Puntos por cada dólar donado, y bonus por compartir la donación en X.
  points_per_usd_donated: 10,
  points_share_donation: 15,
  // Comisión de compra/venta que vuelve al trader en puntos (% de la fee).
  points_trade_cashback_pct: 40,
}

export async function getPointRules(): Promise<Record<string, number>> {
  const settings = await db.setting.findMany({ where: { key: { startsWith: 'points_' } } })
  const rules: Record<string, number> = { ...POINT_RULE_DEFAULTS }
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
  customAmount?: number,
  /** Solo en 'referral': el afiliado que generó el bonus */
  sourceUserId?: string
): Promise<number> {
  const amount =
    customAmount ??
    (REASON_TO_KEY[reason] ? (await getPointRules())[REASON_TO_KEY[reason]] ?? 0 : 0)
  if (amount === 0) return 0
  await db.$transaction([
    db.pointEvent.create({ data: { userId, amount, reason, note, sourceUserId } }),
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
  // El cashback de trading no suma aquí: quien invitó ya cobra su parte de esa
  // misma comisión con 'swap_referral', y pagarla dos veces saldría de tu margen.
  if (reason !== 'referral' && reason !== 'trade_cashback' && amount > 0) {
    try {
      const earner = await db.user.findUnique({ where: { id: userId }, select: { referredById: true } })
      if (earner?.referredById) {
        const pct = await getReferralPercent()
        const bonus = Math.floor((amount * pct) / 100)
        if (bonus > 0) {
          await awardPoints(earner.referredById, 'referral', note ? `${pct}% referido · ${note}` : `${pct}% de puntos de tu invitado`, bonus, userId)
        }
      }
    } catch {
      /* el bonus de referido nunca rompe el otorgamiento principal */
    }
  }
  return amount
}

/**
 * Puntos que gana quien invitó al trader por una compra/venta con comisión:
 * points_swap_referral_pct% del valor en USD de la comisión, convertido a
 * puntos con points_per_usd_fee. En vez de repartir la comisión en dinero de
 * verdad (que exigiría que Cabal custodie fondos para pagar automático), se
 * reparte en puntos — mismo espíritu, sin ese riesgo, mientras no haya mejor
 * infraestructura para pagos automáticos.
 */
export async function swapReferralPointsFor(feeUsd: number): Promise<number> {
  const rules = await getPointRules()
  const pct = rules.points_swap_referral_pct ?? 25
  const perUsd = rules.points_per_usd_fee ?? 100
  return Math.floor(feeUsd * (pct / 100) * perUsd)
}

/**
 * Cashback de trading: el points_trade_cashback_pct% de la comisión cobrada
 * vuelve al propio trader en puntos (con points_per_usd_fee). Va atado a la
 * fee y no al volumen, así nunca se regala más de lo que se cobra y hacer
 * trades en bucle cuesta siempre más de lo que devuelve.
 */
export async function tradeCashbackPointsFor(feeUsd: number): Promise<number> {
  const rules = await getPointRules()
  const pct = rules.points_trade_cashback_pct ?? 40
  const perUsd = rules.points_per_usd_fee ?? 100
  return Math.floor(feeUsd * (pct / 100) * perUsd)
}

export async function requireAdmin(req?: Request) {
  // Acceso si trae la cookie de sesión de /admin O si el usuario actual es admin.
  // La cookie va primero: sin sesión de usuario (p. ej. en incógnito)
  // getCurrentUser lanza "No current user" y todo el panel /admin daba 500.
  if (req && isAdminRequest(req)) return
  // Solo cuenta una sesión de usuario real: el usuario invitado/demo
  // (isCurrentUser) no puede dar acceso de admin a cualquiera sin sesión.
  const sessionUserId = await sessionUserIdFromCookies().catch(() => null)
  if (sessionUserId) {
    const me = await db.user.findUnique({ where: { id: sessionUserId }, select: { isAdmin: true } })
    if (me?.isAdmin) return
  }
  throw new ForbiddenError()
}

export class ForbiddenError extends Error {
  constructor() {
    super('Admin access required')
  }
}

/** Cada cuánto se refresca lastSeenAt como mucho: una escritura por usuario y rato. */
const LAST_SEEN_EVERY_MS = 5 * 60 * 1000

/**
 * Marca que el usuario está conectado ahora mismo. Solo escribe si su última
 * marca tiene ya un rato, para no meter un UPDATE en cada petición de la app.
 * No interrumpe la respuesta si falla (p. ej. antes de aplicar la migración).
 */
async function touchLastSeen(user: { id: string; lastSeenAt: Date | null }) {
  const now = Date.now()
  if (user.lastSeenAt && now - user.lastSeenAt.getTime() < LAST_SEEN_EVERY_MS) return
  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {})
}

export async function getCurrentUser() {
  await ensureSeeded()
  // 1) Si hay sesión de usuario (cookie), esa es la cuenta activa
  const sessionUserId = await sessionUserIdFromCookies()
  if (sessionUserId) {
    const sessionUser = await db.user.findUnique({ where: { id: sessionUserId } })
    if (sessionUser) {
      await touchLastSeen(sessionUser)
      return sessionUser
    }
  }
  // 2) Modo invitado: el usuario demo de la app
  const user = await db.user.findFirst({ where: { isCurrentUser: true } })
  if (!user) throw new Error('No current user')
  return user
}

/** Petición de escritura sin sesión real: se responde 401, no se actúa como el invitado. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Inicia sesión para hacer esto')
  }
}

/**
 * Para escrituras: solo una sesión real. Nunca cae en el usuario demo, que
 * sin esto dejaba a cualquier visitante anónimo publicar, votar o vincular
 * wallets en nombre de esa cuenta (que además es admin en la semilla).
 */
export async function requireSessionUser() {
  const sessionUserId = await sessionUserIdFromCookies()
  const user = sessionUserId ? await db.user.findUnique({ where: { id: sessionUserId } }) : null
  if (!user) throw new UnauthorizedError()
  await touchLastSeen(user)
  return user
}

/** Estado HTTP para un error capturado en una ruta: 401/403 si toca, 500 si no. */
export function errorStatus(e: unknown): number {
  if (e instanceof UnauthorizedError) return 401
  if (e instanceof ForbiddenError) return 403
  return 500
}

/**
 * Para lecturas públicas (GET): nunca falla. Devuelve el id de quien mira o,
 * sin sesión ni usuario demo, un id que no existe (sus votos/follows salen vacíos).
 * Así un visitante sin cuenta ve el radar, el feed y los tokens.
 */
export async function getReaderId(): Promise<string> {
  try {
    return (await getCurrentUser()).id
  } catch {
    return '__guest__'
  }
}

export async function getUserVotes(userId: string) {
  const votes = await db.vote.findMany({ where: { userId } })
  return {
    launchHypes: new Set(votes.filter((v) => v.target === 'launch' && v.kind !== 'fud').map((v) => v.targetId)),
    launchFuds: new Set(votes.filter((v) => v.target === 'launch' && v.kind === 'fud').map((v) => v.targetId)),
    postLikes: new Set(votes.filter((v) => v.target === 'post').map((v) => v.targetId)),
  }
}

export async function getFollowedIds(userId: string) {
  const follows = await db.follow.findMany({ where: { userId } })
  return new Set(follows.map((f) => f.targetId))
}

/**
 * `status` del DTO a partir de la fase real del launch. Un launch de fecha
 * estimada cuya hora ya pasó sigue como `upcoming`: nadie ha lanzado nada
 * todavía, así que se queda en Próximos (pendiente) durante la gracia.
 */
export function computeLaunchStatus(launchAt: Date, dateConfirmed = true): string {
  const phase = launchPhase(launchAt, dateConfirmed)
  if (phase === 'upcoming' || phase === 'pending') return 'upcoming'
  if (phase === 'live' || phase === 'recent') return 'live'
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
