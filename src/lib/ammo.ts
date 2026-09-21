import { db } from '@/lib/db'
import { cached, invalidate } from '@/lib/cache'
import { PLAN_KEYS, type PlanKey } from '@/lib/premium'
import type { AmmoPackDTO, AmmoSettings, BoostDTO, BoostTarget } from '@/lib/types'

/**
 * Munición: el sistema de boosts de Cabal.
 *
 * Una bala = un minuto de proyecto destacado. Se compran en cargadores
 * (packs), los planes Premium regalan unas cuantas al activarse, y se
 * disparan sobre un launch del Radar o sobre un token ya lanzado.
 *
 * La vida de un disparo es aritmética de reloj: endsAt = inicio + balas
 * minutos. Las balas que le quedan a un proyecto se calculan restando, así
 * que no hay ningún proceso descontando munición y nada se queda a medias si
 * el servidor se reinicia.
 *
 * Los disparos se suman: la puntuación de un proyecto son todas las balas
 * vivas de todos los que le han disparado, y eso es lo que lo ordena arriba
 * del Radar. Pasado el umbral dorado, además, se pinta de oro.
 */

// ---------- Cargadores ----------
export const PACK_KEYS = ['clip', 'box', 'crate', 'arsenal'] as const
export type PackKey = (typeof PACK_KEYS)[number]

export const PACKS: Record<PackKey, { label: string; bullets: number; defaultPriceUsd: number }> = {
  clip: { label: 'Cargador', bullets: 100, defaultPriceUsd: 9 },
  box: { label: 'Caja', bullets: 500, defaultPriceUsd: 39 },
  crate: { label: 'Cajón', bullets: 1_440, defaultPriceUsd: 99 },
  arsenal: { label: 'Arsenal', bullets: 5_000, defaultPriceUsd: 299 },
}

export function isPackKey(v: unknown): v is PackKey {
  return typeof v === 'string' && (PACK_KEYS as readonly string[]).includes(v)
}

/** Balas que regala cada plan al activarse. Mensual 24 h, semestral 3 días, anual 7. */
const DEFAULT_PLAN_GIFTS: Record<PlanKey, number> = {
  monthly: 1_440,
  biannual: 4_320,
  annual: 10_080,
}

/** Balas activas a partir de las cuales el proyecto se pinta de oro. */
const DEFAULT_GOLDEN_AT = 1_000

/**
 * Balas de UN disparo a partir de las cuales se avisa en Telegram y Discord.
 * Alto a propósito: el aviso solo vale si es raro — si saltara con cada bala,
 * los grupos lo apagarían el primer día.
 */
const DEFAULT_NOTIFY_AT = 1_000

/**
 * Promoción de lanzamiento: descuento sobre el precio de lista de TODOS los
 * cargadores. Empieza apagada — se enciende desde /admin con su fecha de fin.
 */
const DEFAULT_PROMO_PCT = 0

/** Tope por disparo: evita que un dedo torpe vacíe un arsenal de golpe. */
export const MAX_BULLETS_PER_SHOT = 50_000

const DEFAULTS: AmmoSettings = {
  prices: Object.fromEntries(PACK_KEYS.map((k) => [k, PACKS[k].defaultPriceUsd])) as Record<PackKey, number | null>,
  planGifts: { ...DEFAULT_PLAN_GIFTS },
  goldenAt: DEFAULT_GOLDEN_AT,
  notifyAt: DEFAULT_NOTIFY_AT,
  promoPct: DEFAULT_PROMO_PCT,
  promoUntil: null,
}

const priceKey = (p: PackKey) => `ammo_price_${p}`
const giftKey = (p: PlanKey) => `ammo_gift_${p}`
const GOLDEN_KEY = 'ammo_golden_at'
const NOTIFY_KEY = 'ammo_notify_at'
const PROMO_PCT_KEY = 'ammo_promo_pct'
const PROMO_UNTIL_KEY = 'ammo_promo_until'
const SETTINGS_CACHE = 'settings:ammo'

/** Precio válido en USD, o null si el cargador no está a la venta. */
export function parseAmmoPrice(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= 100_000 ? Math.round(n * 100) / 100 : null
}

/** Descuento de la promo, 0-90 %. Por encima de 90 sería regalarlo. */
function parsePromoPct(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(90, Math.round(n)) : 0
}

/** Fin de la promo en ISO, o null si no caduca / no vale. */
function parsePromoUntil(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function parseBullets(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.floor(n) : fallback
}

export async function getAmmoSettings(): Promise<AmmoSettings> {
  return cached(SETTINGS_CACHE, 30, async () => {
    const rows = await db.setting.findMany({ where: { key: { startsWith: 'ammo_' } } })
    const map = new Map(rows.map((r) => [r.key, r.value]))
    const prices = { ...DEFAULTS.prices }
    for (const p of PACK_KEYS) {
      const raw = map.get(priceKey(p))
      if (raw !== undefined) prices[p] = parseAmmoPrice(raw)
    }
    const planGifts = { ...DEFAULTS.planGifts }
    for (const p of PLAN_KEYS) {
      const raw = map.get(giftKey(p))
      if (raw !== undefined) planGifts[p] = parseBullets(raw, DEFAULTS.planGifts[p])
    }
    return {
      prices,
      planGifts,
      goldenAt: parseBullets(map.get(GOLDEN_KEY), DEFAULT_GOLDEN_AT) || DEFAULT_GOLDEN_AT,
      notifyAt: parseBullets(map.get(NOTIFY_KEY), DEFAULT_NOTIFY_AT) || DEFAULT_NOTIFY_AT,
      promoPct: parsePromoPct(map.get(PROMO_PCT_KEY)),
      promoUntil: parsePromoUntil(map.get(PROMO_UNTIL_KEY)),
    }
  })
}

export async function saveAmmoSettings(input: {
  prices?: Partial<Record<string, unknown>>
  planGifts?: Partial<Record<string, unknown>>
  goldenAt?: unknown
  notifyAt?: unknown
  promoPct?: unknown
  promoUntil?: unknown
}): Promise<AmmoSettings> {
  const writes: { key: string; value: string }[] = []
  for (const p of PACK_KEYS) {
    if (!input.prices || !(p in input.prices)) continue
    const price = parseAmmoPrice(input.prices[p])
    writes.push({ key: priceKey(p), value: price === null ? '' : String(price) })
  }
  for (const p of PLAN_KEYS) {
    if (!input.planGifts || !(p in input.planGifts)) continue
    writes.push({ key: giftKey(p), value: String(parseBullets(input.planGifts[p], DEFAULT_PLAN_GIFTS[p])) })
  }
  if (input.goldenAt !== undefined) {
    writes.push({
      key: GOLDEN_KEY,
      value: String(parseBullets(input.goldenAt, DEFAULT_GOLDEN_AT) || DEFAULT_GOLDEN_AT),
    })
  }
  if (input.promoPct !== undefined) {
    writes.push({ key: PROMO_PCT_KEY, value: String(parsePromoPct(input.promoPct)) })
  }
  if (input.promoUntil !== undefined) {
    writes.push({ key: PROMO_UNTIL_KEY, value: parsePromoUntil(input.promoUntil) ?? '' })
  }
  if (input.notifyAt !== undefined) {
    writes.push({
      key: NOTIFY_KEY,
      value: String(parseBullets(input.notifyAt, DEFAULT_NOTIFY_AT) || DEFAULT_NOTIFY_AT),
    })
  }
  if (writes.length) {
    await db.$transaction(
      writes.map((w) => db.setting.upsert({ where: { key: w.key }, update: { value: w.value }, create: w }))
    )
  }
  await invalidate(SETTINGS_CACHE)
  return getAmmoSettings()
}

/**
 * ¿Hay promoción de lanzamiento viva? Lleva fecha de fin a propósito: un
 * "antes 99 $" permanente que nadie ha pagado nunca no es un precio de
 * referencia, es un adorno — y en la UE y en EE.UU. eso se regula.
 */
export function promoActive(settings: AmmoSettings, now = Date.now()): boolean {
  if (settings.promoPct <= 0) return false
  if (!settings.promoUntil) return true
  const until = new Date(settings.promoUntil).getTime()
  return Number.isFinite(until) && until > now
}

/**
 * Lo que de verdad se cobra por un cargador. La usan tanto la pantalla de
 * compra como el checkout: si solo la aplicase la pantalla, el cliente vería
 * el descuento y luego pagaría el precio entero.
 */
export function priceToCharge(listPriceUsd: number, settings: AmmoSettings, now = Date.now()): number {
  if (!promoActive(settings, now)) return listPriceUsd
  return Math.round(listPriceUsd * (1 - settings.promoPct / 100) * 100) / 100
}

/** Los cargadores tal y como se le enseñan a quien va a comprar. */
export function packsFor(settings: AmmoSettings, methods: { card: boolean; crypto: boolean }): AmmoPackDTO[] {
  const onPromo = promoActive(settings)
  return PACK_KEYS.flatMap((key) => {
    const listPrice = settings.prices[key]
    if (listPrice === null) return []
    const { label, bullets } = PACKS[key]
    const priceUsd = priceToCharge(listPrice, settings)

    // Con promoción, lo tachado es el precio de lista y el descuento es el de
    // la promo. Sin ella se enseña el ahorro por volumen: lo que costarían
    // esas balas comprando cargadores pequeños.
    let fullPriceUsd: number | null = null
    let savingsPct = 0
    if (onPromo) {
      fullPriceUsd = listPrice
      savingsPct = Math.round((1 - priceUsd / listPrice) * 100)
    } else {
      const base = settings.prices.clip
      const unitBase = base === null ? null : base / PACKS.clip.bullets
      const byVolume = unitBase === null ? null : Math.round(unitBase * bullets * 100) / 100
      savingsPct = byVolume && byVolume > priceUsd ? Math.round((1 - priceUsd / byVolume) * 100) : 0
      fullPriceUsd = savingsPct > 0 ? byVolume : null
    }

    return [
      {
        key,
        label,
        bullets,
        priceUsd,
        hours: Math.round((bullets / 60) * 10) / 10,
        fullPriceUsd,
        savingsPct,
        card: methods.card,
        crypto: methods.crypto,
      },
    ]
  })
}

// ---------- Saldo ----------
export async function ammoBalance(userId: string | null): Promise<number> {
  if (!userId) return 0
  const u = await db.user.findUnique({ where: { id: userId }, select: { ammo: true } })
  return u?.ammo ?? 0
}

/**
 * Mete balas en el saldo y deja constancia de por qué. Es idempotente cuando
 * se le pasa `paymentId` o `subscriptionId`: si esas balas ya se acreditaron
 * (webhook repetido, reintento de una IPN) la segunda vez no hace nada y
 * devuelve false.
 */
export async function creditAmmo(
  userId: string,
  bullets: number,
  opts: {
    reason: 'purchase' | 'plan_gift' | 'admin'
    packKey?: string
    paymentId?: string
    subscriptionId?: string
    note?: string
  }
): Promise<boolean> {
  if (bullets <= 0) return false
  try {
    await db.$transaction([
      db.ammoEntry.create({
        data: {
          userId,
          amount: bullets,
          reason: opts.reason,
          packKey: opts.packKey ?? null,
          paymentId: opts.paymentId ?? null,
          subscriptionId: opts.subscriptionId ?? null,
          note: opts.note ?? '',
        },
      }),
      db.user.update({ where: { id: userId }, data: { ammo: { increment: bullets } } }),
    ])
    return true
  } catch (e) {
    // P2002 = ese pago o esa suscripción ya habían acreditado sus balas
    if ((e as { code?: string })?.code === 'P2002') return false
    throw e
  }
}

/** Quita balas del saldo (solo admin; un disparo las quita dentro de fireAmmo). */
export async function debitAmmo(userId: string, bullets: number, note = ''): Promise<boolean> {
  if (bullets <= 0) return false
  // En transacción: si el apunte del historial falla, el saldo no se queda
  // descontado sin que conste por qué.
  try {
    await db.$transaction(async (tx) => {
      const done = await tx.user.updateMany({
        where: { id: userId, ammo: { gte: bullets } },
        data: { ammo: { decrement: bullets } },
      })
      if (done.count === 0) throw new Error('SIN_MUNICION')
      await tx.ammoEntry.create({ data: { userId, amount: -bullets, reason: 'admin', note } })
    })
    return true
  } catch (e) {
    if ((e as Error).message === 'SIN_MUNICION') return false
    throw e
  }
}

// ---------- Disparar ----------
export function isBoostTarget(v: unknown): v is BoostTarget {
  return v === 'launch' || v === 'token'
}

/**
 * Gasta balas sobre un proyecto y crea el disparo. El descuento del saldo va
 * condicionado (`ammo: { gte: bullets }`) dentro de una transacción: dos
 * clics a la vez no pueden gastar la misma bala dos veces.
 */
export async function fireAmmo(p: {
  userId: string
  targetType: BoostTarget
  targetId: string
  bullets: number
}): Promise<{ ok: true; boost: BoostDTO } | { ok: false; error: string }> {
  const bullets = Math.floor(p.bullets)
  if (!Number.isFinite(bullets) || bullets < 1) return { ok: false, error: 'Elige cuántas balas quieres disparar' }
  if (bullets > MAX_BULLETS_PER_SHOT) {
    return {
      ok: false,
      error: `No se pueden disparar más de ${MAX_BULLETS_PER_SHOT.toLocaleString('es')} balas de una vez`,
    }
  }

  const now = new Date()
  const endsAt = new Date(now.getTime() + bullets * 60_000)
  try {
    const boost = await db.$transaction(async (tx) => {
      const spent = await tx.user.updateMany({
        where: { id: p.userId, ammo: { gte: bullets } },
        data: { ammo: { decrement: bullets } },
      })
      if (spent.count === 0) throw new Error('SIN_MUNICION')
      const created = await tx.boost.create({
        data: { userId: p.userId, targetType: p.targetType, targetId: p.targetId, bullets, startedAt: now, endsAt },
      })
      await tx.ammoEntry.create({
        data: { userId: p.userId, amount: -bullets, reason: 'boost', boostId: created.id },
      })
      return created
    })
    await invalidate('boosts:active')
    return {
      ok: true,
      boost: {
        id: boost.id,
        targetType: p.targetType,
        targetId: p.targetId,
        bullets,
        startedAt: boost.startedAt.toISOString(),
        endsAt: boost.endsAt.toISOString(),
      },
    }
  } catch (e) {
    if ((e as Error).message === 'SIN_MUNICION') {
      return { ok: false, error: 'No te quedan balas suficientes. Compra un cargador.' }
    }
    throw e
  }
}

// ---------- Leer los boosts ----------
export type BoostScore = {
  /** Balas vivas ahora mismo: la puntuación que ordena el Radar. */
  bullets: number
  /** Cuándo se apaga el último disparo. */
  endsAt: string
  /** Balas disparadas en total sobre el proyecto (también las ya gastadas). */
  lifetime: number
  /** Cuántas personas distintas le han disparado mientras sigue vivo. */
  shooters: number
  golden: boolean
  /** Quién fue el último en recargar, para enseñar su cara en el banner. */
  lastShooter: { handle: string; name: string; avatar: string } | null
  /** Cuándo se recargó por última vez: el cliente lo usa para el fogonazo. */
  lastShotAt: string
}

const scoreKey = (t: string, id: string) => `${t}:${id}`

/**
 * Puntuación de todos los proyectos con munición viva, listos para ordenar el
 * Radar. Cacheado 15 s: el número baja una bala por minuto, no hace falta ir a
 * la base en cada visita.
 */
export async function activeBoostScores(): Promise<Record<string, BoostScore>> {
  const [rows, settings] = await Promise.all([
    cached('boosts:active', 15, async () => {
      const live = await db.boost.findMany({
        where: { endsAt: { gt: new Date() } },
        select: {
          targetType: true,
          targetId: true,
          userId: true,
          bullets: true,
          endsAt: true,
          createdAt: true,
          // Para poder enseñar la cara del último que recargó. Va dentro de la
          // caché: son unas pocas filas y así no se piden los usuarios en cada visita.
          user: { select: { handle: true, name: true, avatar: true } },
        },
      })
      return live.map((b) => ({
        ...b,
        endsAt: b.endsAt.toISOString(),
        createdAt: b.createdAt.toISOString(),
      }))
    }),
    getAmmoSettings(),
  ])

  const now = Date.now()
  type Acc = {
    bullets: number
    endsAt: number
    lifetime: number
    shooters: Set<string>
    lastAt: number
    lastShooter: BoostScore['lastShooter']
  }
  const acc = new Map<string, Acc>()
  for (const b of rows) {
    const ends = new Date(b.endsAt).getTime()
    // Un disparo que ya se apagó (la caché va 15 s por detrás) no puntúa.
    const left = Math.max(0, Math.ceil((ends - now) / 60_000))
    if (left === 0) continue
    const k = scoreKey(b.targetType, b.targetId)
    const cur: Acc = acc.get(k) ?? {
      bullets: 0,
      endsAt: 0,
      lifetime: 0,
      shooters: new Set<string>(),
      lastAt: 0,
      lastShooter: null,
    }
    cur.bullets += left
    cur.lifetime += b.bullets
    cur.endsAt = Math.max(cur.endsAt, ends)
    cur.shooters.add(b.userId)
    const at = new Date(b.createdAt).getTime()
    if (at >= cur.lastAt) {
      cur.lastAt = at
      cur.lastShooter = b.user
    }
    acc.set(k, cur)
  }

  const out: Record<string, BoostScore> = {}
  for (const [k, v] of acc) {
    out[k] = {
      bullets: v.bullets,
      endsAt: new Date(v.endsAt).toISOString(),
      lifetime: v.lifetime,
      shooters: v.shooters.size,
      golden: v.bullets >= settings.goldenAt,
      lastShooter: v.lastShooter,
      lastShotAt: new Date(v.lastAt).toISOString(),
    }
  }
  return out
}

/** Busca la puntuación de un proyecto concreto dentro del mapa de arriba. */
export function boostOf(
  scores: Record<string, BoostScore>,
  targetType: string,
  targetId: string
): BoostScore | null {
  return scores[scoreKey(targetType, targetId)] ?? null
}

/**
 * Regala al usuario las balas que trae su plan. Se ata a la suscripción que lo
 * provocó, así que una renovación reintentada o un webhook repetido no regalan
 * dos veces; una renovación de verdad (suscripción nueva) sí vuelve a regalar.
 */
export async function giftPlanAmmo(userId: string, plan: string, subscriptionId: string): Promise<number> {
  const settings = await getAmmoSettings()
  const bullets = settings.planGifts[plan] ?? 0
  if (bullets <= 0) return 0
  const done = await creditAmmo(userId, bullets, {
    reason: 'plan_gift',
    subscriptionId,
    note: `Munición del plan ${plan}`,
  })
  return done ? bullets : 0
}
