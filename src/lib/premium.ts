import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { cached, invalidate } from '@/lib/cache'
import type { FieldMode, PremiumField, PremiumStatusDTO } from '@/lib/types'

/**
 * Plan premium: qué datos de un launch son de pago, quién puede verlos y cuánto
 * cuesta cada plan. Lo configurable (visibilidad de cada campo y precios) vive
 * en Setting y se edita desde el panel de admin.
 *
 * El acceso sale de la tabla Subscription: una fila por suscripción de Stripe,
 * por pago en cripto o por concesión del admin.
 */

// ---------- Planes ----------
export const PLAN_KEYS = ['monthly', 'biannual', 'annual'] as const
export type PlanKey = (typeof PLAN_KEYS)[number]

export const PLANS: Record<
  PlanKey,
  { label: string; months: number; days: number; interval: 'month' | 'year'; intervalCount: number }
> = {
  monthly: { label: 'Mensual', months: 1, days: 30, interval: 'month', intervalCount: 1 },
  biannual: { label: 'Semestral', months: 6, days: 182, interval: 'month', intervalCount: 6 },
  annual: { label: 'Anual', months: 12, days: 365, interval: 'year', intervalCount: 1 },
}

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && (PLAN_KEYS as readonly string[]).includes(v)
}

// ---------- Configuración (panel admin) ----------
export const PREMIUM_FIELDS: readonly PremiumField[] = ['devWallet', 'launchpad', 'contract']
const FIELD_MODES: readonly FieldMode[] = ['public', 'premium', 'hidden']

export type PremiumSettings = {
  fields: Record<PremiumField, FieldMode>
  /** USD por periodo; null = el plan no se ofrece. */
  prices: Record<PlanKey, number | null>
}

const DEFAULTS: PremiumSettings = {
  fields: { devWallet: 'premium', launchpad: 'premium', contract: 'premium' },
  prices: { monthly: 25, biannual: 126, annual: 228 },
}

const fieldKey = (f: PremiumField) => `premium_field_${f}`
const priceKey = (p: PlanKey) => `premium_price_${p}`
const SETTINGS_CACHE = 'settings:premium'

export async function getPremiumSettings(): Promise<PremiumSettings> {
  return cached(SETTINGS_CACHE, 30, async () => {
    const rows = await db.setting.findMany({ where: { key: { startsWith: 'premium_' } } })
    const map = new Map(rows.map((r) => [r.key, r.value]))
    const fields = { ...DEFAULTS.fields }
    for (const f of PREMIUM_FIELDS) {
      const v = map.get(fieldKey(f))
      if (v && (FIELD_MODES as readonly string[]).includes(v)) fields[f] = v as FieldMode
    }
    const prices = { ...DEFAULTS.prices }
    for (const p of PLAN_KEYS) {
      const raw = map.get(priceKey(p))
      if (raw === undefined) continue
      prices[p] = parsePrice(raw)
    }
    return { fields, prices }
  })
}

/** Precio válido en USD (con céntimos) o null si está vacío o no tiene sentido. */
export function parsePrice(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= 100_000 ? Math.round(n * 100) / 100 : null
}

export async function savePremiumSettings(input: {
  fields?: Partial<Record<string, unknown>>
  prices?: Partial<Record<string, unknown>>
}): Promise<PremiumSettings> {
  const writes: { key: string; value: string }[] = []
  for (const f of PREMIUM_FIELDS) {
    const v = input.fields?.[f]
    if (typeof v === 'string' && (FIELD_MODES as readonly string[]).includes(v)) writes.push({ key: fieldKey(f), value: v })
  }
  for (const p of PLAN_KEYS) {
    if (!input.prices || !(p in input.prices)) continue
    const price = parsePrice(input.prices[p])
    writes.push({ key: priceKey(p), value: price === null ? '' : String(price) })
  }
  if (writes.length) {
    await db.$transaction(
      writes.map((w) =>
        db.setting.upsert({ where: { key: w.key }, update: { value: w.value }, create: w })
      )
    )
  }
  await invalidate(SETTINGS_CACHE)
  return getPremiumSettings()
}

// ---------- Quién es premium ----------
/** Estados que dan acceso. En past_due Stripe sigue reintentando el cobro. */
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
/** Margen tras el fin del periodo de Stripe, por si el aviso de la renovación llega tarde. */
const STRIPE_GRACE_MS = 24 * 3600_000

function activeWhere(userId: string): Prisma.SubscriptionWhereInput {
  const now = Date.now()
  return {
    userId,
    status: { in: ACTIVE_STATUSES },
    OR: [
      // Solo una concesión del admin puede no caducar nunca
      { provider: 'admin', currentPeriodEnd: null },
      { provider: 'stripe', currentPeriodEnd: { gt: new Date(now - STRIPE_GRACE_MS) } },
      { provider: { not: 'stripe' }, currentPeriodEnd: { gt: new Date(now) } },
    ],
  }
}

export async function hasPremium(userId: string): Promise<boolean> {
  return (await db.subscription.count({ where: activeWhere(userId) })) > 0
}

/**
 * De una lista de usuarios, cuáles tienen Premium activo ahora mismo. Una sola
 * consulta en vez de una por usuario — la usan los avisos de lanzamientos,
 * que pueden mirar a decenas de personas por launch.
 */
export async function premiumUserIdsAmong(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const now = Date.now()
  const rows = await db.subscription.findMany({
    where: {
      userId: { in: userIds },
      status: { in: ACTIVE_STATUSES },
      OR: [
        { provider: 'admin', currentPeriodEnd: null },
        { provider: 'stripe', currentPeriodEnd: { gt: new Date(now - STRIPE_GRACE_MS) } },
        { provider: { not: 'stripe' }, currentPeriodEnd: { gt: new Date(now) } },
      ],
    },
    select: { userId: true },
  })
  return new Set(rows.map((r) => r.userId))
}

/** La misma regla que activeWhere, para una fila ya cargada (panel de admin). */
export function subscriptionIsActive(
  s: { provider: string; status: string; currentPeriodEnd: Date | null },
  now = Date.now()
): boolean {
  if (!ACTIVE_STATUSES.includes(s.status)) return false
  if (!s.currentPeriodEnd) return s.provider === 'admin'
  const grace = s.provider === 'stripe' ? STRIPE_GRACE_MS : 0
  return s.currentPeriodEnd.getTime() > now - grace
}

/**
 * Quien hace la petición, visto desde el plan premium. Mira la sesión real y
 * no getCurrentUser(): este cae en la cuenta demo cuando no hay cookie, y un
 * visitante nunca debe heredar el acceso (ni el rol de admin) de esa cuenta.
 */
export type Viewer = {
  userId: string | null
  isAdmin: boolean
  premium: boolean
}

export async function getViewer(req: Request): Promise<Viewer> {
  const adminPanel = isAdminRequest(req)
  const sessionId = await sessionUserIdFromCookies()
  const user = sessionId
    ? await db.user.findUnique({ where: { id: sessionId }, select: { id: true, isAdmin: true } })
    : null
  const isAdmin = adminPanel || Boolean(user?.isAdmin)
  const premium = isAdmin || (user ? await hasPremium(user.id) : false)
  return { userId: user?.id ?? null, isAdmin, premium }
}

const INACTIVE: PremiumStatusDTO = {
  active: false,
  source: null,
  plan: null,
  until: null,
  renews: false,
  cancelAtPeriodEnd: false,
  pastDue: false,
  canManageBilling: false,
}

/** Estado premium de una cuenta, tal y como se le enseña a ella misma. */
export async function premiumStatus(userId: string | null, isAdmin = false): Promise<PremiumStatusDTO> {
  if (!userId) return INACTIVE
  const [subs, user] = await Promise.all([
    db.subscription.findMany({ where: activeWhere(userId) }),
    db.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } }),
  ])
  const canManageBilling = Boolean(user?.stripeCustomerId)
  if (subs.length === 0) {
    return isAdmin ? { ...INACTIVE, active: true, source: 'staff', canManageBilling } : { ...INACTIVE, canManageBilling }
  }
  // Manda el acceso que llega más lejos (sin fecha = no caduca)
  const main = [...subs].sort((a, b) => endMs(b.currentPeriodEnd) - endMs(a.currentPeriodEnd))[0]
  const stripeSub = subs.find((s) => s.provider === 'stripe')
  return {
    active: true,
    source: main.provider as PremiumStatusDTO['source'],
    plan: main.plan,
    until: main.currentPeriodEnd?.toISOString() ?? null,
    renews: Boolean(stripeSub && !stripeSub.cancelAtPeriodEnd && stripeSub.status !== 'past_due'),
    cancelAtPeriodEnd: Boolean(stripeSub?.cancelAtPeriodEnd),
    pastDue: subs.some((s) => s.status === 'past_due'),
    canManageBilling,
  }
}

const endMs = (d: Date | null) => (d ? d.getTime() : Number.POSITIVE_INFINITY)

/** ¿Tiene ya una suscripción de Stripe viva? (evita pagar dos a la vez) */
export async function activeStripeSubscription(userId: string) {
  return db.subscription.findFirst({
    where: { ...activeWhere(userId), provider: 'stripe' },
  })
}

// ---------- Conceder tiempo (cripto y admin) ----------
/**
 * Añade días de acceso. Se encadenan: si ya tenía un acceso de pago único en
 * curso, el nuevo empieza cuando acaba ese (pagar dos meses seguidos son dos
 * meses, no uno solapado).
 */
export async function grantDays(
  userId: string,
  days: number | null,
  opts: { provider: 'nowpayments' | 'admin'; plan: string; paymentId?: string; note?: string }
) {
  const now = new Date()
  let end: Date | null = null
  if (days !== null) {
    const current = await db.subscription.findFirst({
      where: {
        userId,
        provider: { in: ['nowpayments', 'admin'] },
        status: 'active',
        currentPeriodEnd: { gt: now },
      },
      orderBy: { currentPeriodEnd: 'desc' },
    })
    const start = current?.currentPeriodEnd ?? now
    end = new Date(start.getTime() + days * 24 * 3600_000)
  }
  return db.subscription.create({
    data: {
      userId,
      provider: opts.provider,
      plan: opts.plan,
      status: 'active',
      currentPeriodEnd: end,
      paymentId: opts.paymentId,
      note: opts.note ?? '',
    },
  })
}

// ---------- Datos premium de un launch ----------
/**
 * Nivel de acceso a los datos premium de UN launch:
 *  - team: quien lo publicó, su equipo (invitación aceptada) y los admins → todo
 *  - premium: suscriptor → lo que no esté oculto
 *  - none: el resto → solo lo público
 */
export type LaunchAccess = 'team' | 'premium' | 'none'

export function launchAccess(
  viewer: Viewer,
  launch: { id: string; createdById: string },
  teamLaunchIds: Set<string>
): LaunchAccess {
  if (viewer.isAdmin) return 'team'
  if (viewer.userId && (viewer.userId === launch.createdById || teamLaunchIds.has(launch.id))) return 'team'
  return viewer.premium ? 'premium' : 'none'
}

/** Launches de cuyo equipo forma parte el usuario. */
export async function teamLaunchIdsOf(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set()
  const rows = await db.launchMember.findMany({
    where: { userId, status: 'accepted' },
    select: { launchId: true },
  })
  return new Set(rows.map((r) => r.launchId))
}

function canSee(mode: FieldMode, access: LaunchAccess): boolean {
  if (access === 'team' || mode === 'public') return true
  return mode === 'premium' && access === 'premium'
}

/**
 * Los tres datos premium tal y como los puede ver quien mira. `lockedFields`
 * dice cuáles tiene el launch sin que se le enseñen, para invitarle a Premium;
 * los que el admin marcó como ocultos ni se mencionan.
 */
export function premiumLaunchFields(
  launch: { contract: string | null; devWallet: string | null; launchpad: string | null; launchAt: Date | string },
  access: LaunchAccess,
  fields: Record<PremiumField, FieldMode>
): { contract: string | null; devWallet: string | null; launchpad: string | null; lockedFields: PremiumField[] } {
  const lockedFields: PremiumField[] = []
  const pick = (field: PremiumField, value: string | null, gated = true) => {
    if (!value) return null
    if (!gated || canSee(fields[field], access)) return value
    if (fields[field] === 'premium') lockedFields.push(field)
    return null
  }
  // El contrato solo es exclusivo ANTES del lanzamiento: después está en la
  // pestaña Tokens y en cualquier explorador de todos modos.
  const upcoming = new Date(launch.launchAt).getTime() > Date.now()
  return {
    contract: pick('contract', launch.contract, upcoming),
    devWallet: pick('devWallet', launch.devWallet),
    launchpad: pick('launchpad', launch.launchpad),
    lockedFields,
  }
}
