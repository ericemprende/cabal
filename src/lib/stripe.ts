import Stripe from 'stripe'
import { db } from '@/lib/db'
import { PLANS, isPlanKey, type PlanKey } from '@/lib/premium'
import { creditAmmo, giftPlanAmmo } from '@/lib/ammo'

/**
 * Cobro con tarjeta (Stripe Checkout, suscripción que se renueva sola).
 *
 * Variables de entorno:
 *  - STRIPE_SECRET_KEY        clave secreta (sk_…) o restringida (rk_…)
 *  - STRIPE_WEBHOOK_SECRET    whsec_… del endpoint /api/webhooks/stripe
 *  - STRIPE_PRODUCT_MONTHLY / STRIPE_PRODUCT_BIANNUAL / STRIPE_PRODUCT_ANNUAL
 *  - STRIPE_PRODUCT_AMMO      producto de los cargadores de munición (pago único)
 *
 * No hacen falta Price IDs: cada Checkout crea el precio en línea sobre el
 * producto con el importe que haya en el panel de admin. Cambiar el precio en el
 * panel afecta a las altas nuevas; quien ya está suscrito conserva el suyo.
 */

let client: Stripe | null = null

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null
}

/** Cliente perezoso: instanciarlo al importar rompería el build sin la clave. */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('Stripe no está configurado')
  if (!client) client = new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: 'Cabal' } })
  return client
}

const PRODUCT_ENV: Record<PlanKey, string> = {
  monthly: 'STRIPE_PRODUCT_MONTHLY',
  biannual: 'STRIPE_PRODUCT_BIANNUAL',
  annual: 'STRIPE_PRODUCT_ANNUAL',
}

export function stripeProductFor(plan: PlanKey): string | null {
  return process.env[PRODUCT_ENV[plan]]?.trim() || null
}

/** ¿Se puede pagar este plan con tarjeta? */
export function stripePlanAvailable(plan: PlanKey): boolean {
  return stripeConfigured() && Boolean(stripeProductFor(plan))
}

/** Producto con el que se cobran los cargadores de munición (pago único). */
export function stripeAmmoProduct(): string | null {
  return process.env.STRIPE_PRODUCT_AMMO?.trim() || null
}

/** ¿Se puede comprar munición con tarjeta? */
export function stripeAmmoAvailable(): boolean {
  return stripeConfigured() && Boolean(stripeAmmoProduct())
}

/** Crea la sesión de Checkout y devuelve la URL a la que mandar al usuario. */
export async function createStripeCheckout(p: {
  user: { id: string; email: string | null; emailVerified: boolean; stripeCustomerId: string | null }
  plan: PlanKey
  priceUsd: number
  origin: string
}): Promise<string> {
  const product = stripeProductFor(p.plan)
  if (!product) throw new Error('Este plan no está disponible con tarjeta')
  const { interval, intervalCount } = PLANS[p.plan]

  // Cliente existente → Checkout reutiliza su tarjeta. Si no, se le propone el
  // correo verificado; sin él, Checkout lo pide.
  const customer = p.user.stripeCustomerId
    ? { customer: p.user.stripeCustomerId }
    : p.user.email && p.user.emailVerified
      ? { customer_email: p.user.email }
      : {}

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          product,
          unit_amount: Math.round(p.priceUsd * 100),
          recurring: { interval, interval_count: intervalCount },
        },
      },
    ],
    ...customer,
    client_reference_id: p.user.id,
    metadata: { userId: p.user.id, plan: p.plan },
    // Viaja a la suscripción y a cada factura: así el webhook sabe de quién es
    subscription_data: { metadata: { userId: p.user.id, plan: p.plan } },
    allow_promotion_codes: true,
    locale: 'es',
    success_url: `${p.origin}/app?premium=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${p.origin}/app?premium=cancel`,
  })
  if (!session.url) throw new Error('Stripe no devolvió la página de pago')
  return session.url
}

function planFromRecurring(r?: { interval: string; interval_count: number } | null): string {
  if (r?.interval === 'year' && r.interval_count === 1) return 'annual'
  if (r?.interval === 'month' && r.interval_count === 6) return 'biannual'
  if (r?.interval === 'month' && r.interval_count === 1) return 'monthly'
  return 'custom'
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : v?.id ?? null)

/**
 * Copia el estado de una suscripción de Stripe a la tabla Subscription.
 * Idempotente, y descarta eventos más viejos que el último aplicado (Stripe no
 * garantiza el orden de entrega).
 *
 * @param at       Momento del estado recibido: `event.created` o ahora si se
 *                 acaba de leer de la API.
 * @param hintUser Usuario a usar si la suscripción no trae metadata.
 */
export async function syncStripeSubscription(sub: Stripe.Subscription, at: Date, hintUser?: string | null) {
  const customerId = idOf(sub.customer)
  let userId = sub.metadata?.userId || hintUser || null
  if (!userId && customerId) {
    userId = (await db.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } }))?.id ?? null
  }
  const user = userId
    ? await db.user.findUnique({ where: { id: userId }, select: { id: true, stripeCustomerId: true } })
    : null
  if (!user) {
    console.warn(`[stripe] suscripción ${sub.id} sin usuario de Cabal asociado`)
    return
  }

  const existing = await db.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } })
  if (existing?.stripeEventAt && existing.stripeEventAt > at) return

  // Desde la API 2025-03-31 el periodo vive en cada item; antes, en la
  // suscripción. El webhook del Dashboard usa la versión por defecto de la
  // cuenta, que puede ser anterior a la del SDK, así que se aceptan las dos.
  const legacyEnd = (sub as unknown as { current_period_end?: number }).current_period_end
  const ends = [...sub.items.data.map((i) => i.current_period_end), legacyEnd].filter(
    (n): n is number => typeof n === 'number'
  )
  const periodEnd = ends.length ? new Date(Math.max(...ends) * 1000) : sub.ended_at ? new Date(sub.ended_at * 1000) : new Date()
  const metaPlan = sub.metadata?.plan
  const data = {
    userId: user.id,
    provider: 'stripe',
    plan: isPlanKey(metaPlan) ? metaPlan : planFromRecurring(sub.items.data[0]?.price?.recurring),
    status: sub.status,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    stripeEventAt: at,
  }
  const row = await db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: { ...data, stripeSubscriptionId: sub.id },
    update: data,
  })
  // Munición de regalo del plan, una sola vez por suscripción: va atada a la
  // fila, así que los eventos repetidos de Stripe no vuelven a regalar. Una
  // renovación anual crea otra suscripción y esa sí trae su munición.
  if (['active', 'trialing'].includes(sub.status)) {
    await giftPlanAmmo(user.id, data.plan, row.id).catch((e) => {
      console.warn('[stripe] no se pudo regalar la munición del plan:', (e as Error).message)
    })
  }
  if (customerId && user.stripeCustomerId !== customerId) {
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } }).catch((e) => {
      console.warn(`[stripe] no se pudo asociar el cliente ${customerId}:`, (e as Error).message)
    })
  }
}

/** Guarda una factura de suscripción (pagada o fallida) en el historial de pagos. */
export async function recordStripeInvoice(inv: Stripe.Invoice, status: 'paid' | 'failed') {
  if (!inv.id) return
  // parent.subscription_details desde la API 2025-03-31; antes, subscription_details
  const legacy = (inv as unknown as { subscription_details?: { metadata?: Record<string, string> | null } })
    .subscription_details
  const meta = inv.parent?.subscription_details?.metadata ?? legacy?.metadata ?? {}
  const customerId = idOf(inv.customer)
  let userId = meta.userId || null
  if (!userId && customerId) {
    userId = (await db.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } }))?.id ?? null
  }
  if (!userId || !(await db.user.findUnique({ where: { id: userId }, select: { id: true } }))) return

  const amountUsd = (status === 'paid' ? inv.amount_paid : inv.amount_due) / 100
  const plan = isPlanKey(meta.plan) ? meta.plan : 'custom'
  await db.payment.upsert({
    where: { provider_externalId: { provider: 'stripe', externalId: inv.id } },
    create: {
      userId,
      provider: 'stripe',
      plan,
      amountUsd,
      status,
      externalId: inv.id,
      payCurrency: inv.currency,
      invoiceUrl: inv.hosted_invoice_url ?? null,
    },
    // Una factura fallida que luego se cobra pasa a pagada, nunca al revés
    update: status === 'paid' ? { status, amountUsd } : {},
  })
}

/** Procesa un evento del webhook ya verificado. Lanza si hay que reintentarlo. */
export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object
      // Los cargadores de munición son pago único, no suscripción
      if (s.mode === 'payment') {
        await creditStripeAmmoSession(s)
        return
      }
      const subId = s.mode === 'subscription' ? idOf(s.subscription) : null
      if (!subId) return
      // Estado fresco de la API: el evento de la sesión no trae la suscripción
      const sub = await stripe().subscriptions.retrieve(subId)
      await syncStripeSubscription(sub, new Date(), s.client_reference_id)
      return
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncStripeSubscription(event.data.object, new Date(event.created * 1000))
      return
    case 'invoice.paid':
      await recordStripeInvoice(event.data.object, 'paid')
      return
    case 'invoice.payment_failed':
      await recordStripeInvoice(event.data.object, 'failed')
      return
  }
}

// ---------- Munición (pago único) ----------

/**
 * Checkout de un cargador de munición: pago único, sin suscripción. El precio
 * se crea en línea sobre STRIPE_PRODUCT_AMMO con lo que haya en el panel de
 * admin, igual que los planes.
 */
export async function createAmmoCheckout(p: {
  user: { id: string; email: string | null; emailVerified: boolean; stripeCustomerId: string | null }
  packKey: string
  label: string
  bullets: number
  priceUsd: number
  origin: string
}): Promise<string> {
  const product = stripeAmmoProduct()
  if (!product) throw new Error('La munición no se puede pagar con tarjeta ahora mismo')

  const customer = p.user.stripeCustomerId
    ? { customer: p.user.stripeCustomerId }
    : p.user.email && p.user.emailVerified
      ? { customer_email: p.user.email }
      : {}

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          product,
          unit_amount: Math.round(p.priceUsd * 100),
        },
      },
    ],
    ...customer,
    client_reference_id: p.user.id,
    // El webhook acredita las balas a partir de esto, no del importe
    metadata: { userId: p.user.id, kind: 'ammo', packKey: p.packKey, bullets: String(p.bullets) },
    payment_intent_data: {
      metadata: { userId: p.user.id, kind: 'ammo', packKey: p.packKey, bullets: String(p.bullets) },
      description: `Cabal · ${p.label} (${p.bullets} balas)`,
    },
    allow_promotion_codes: true,
    locale: 'es',
    success_url: `${p.origin}/app?ammo=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${p.origin}/app?ammo=cancel`,
  })
  if (!session.url) throw new Error('Stripe no devolvió la página de pago')
  return session.url
}

/**
 * Acredita las balas de un Checkout de pago único ya cobrado. Idempotente por
 * partida doble: el Payment se identifica por la sesión (provider+externalId)
 * y AmmoEntry.paymentId es único, así que un evento repetido no regala nada.
 */
async function creditStripeAmmoSession(s: Stripe.Checkout.Session) {
  if (s.metadata?.kind !== 'ammo') return
  if (s.payment_status !== 'paid') return
  const userId = s.metadata.userId || s.client_reference_id
  const bullets = Number(s.metadata.bullets)
  if (!userId || !Number.isFinite(bullets) || bullets <= 0) {
    console.warn(`[stripe] sesión de munición ${s.id} sin usuario o sin balas`)
    return
  }
  if (!(await db.user.findUnique({ where: { id: userId }, select: { id: true } }))) return

  const packKey = s.metadata.packKey ?? 'custom'
  const payment = await db.payment.upsert({
    where: { provider_externalId: { provider: 'stripe', externalId: s.id } },
    create: {
      userId,
      provider: 'stripe',
      plan: `ammo_${packKey}`,
      amountUsd: (s.amount_total ?? 0) / 100,
      status: 'paid',
      externalId: s.id,
      payCurrency: s.currency,
    },
    update: { status: 'paid' },
  })
  const customerId = idOf(s.customer)
  if (customerId) {
    await db.user
      .update({ where: { id: userId }, data: { stripeCustomerId: customerId } })
      .catch(() => {}) // otro usuario ya tiene ese cliente: no es motivo para fallar el webhook
  }
  await creditAmmo(userId, bullets, { reason: 'purchase', packKey, paymentId: payment.id })
}
