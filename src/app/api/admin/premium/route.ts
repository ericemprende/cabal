import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { appOrigin } from '@/lib/oauth'
import { PLAN_KEYS, getPremiumSettings, savePremiumSettings, subscriptionIsActive } from '@/lib/premium'
import { stripeConfigured, stripeProductFor, stripeWebhookSecret } from '@/lib/stripe'
import { nowpaymentsConfigured, nowpaymentsSandbox } from '@/lib/nowpayments'
import type { AdminPremiumDTO } from '@/lib/types'

const userRef = { select: { id: true, handle: true, name: true, avatar: true } } as const

/** GET /api/admin/premium — configuración, pasarelas, suscriptores y pagos. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const origin = appOrigin(req)
    const since30d = new Date(Date.now() - 30 * 24 * 3600_000)
    const [settings, subs, payments, revenue] = await Promise.all([
      getPremiumSettings(),
      db.subscription.findMany({ include: { user: userRef }, orderBy: { createdAt: 'desc' }, take: 200 }),
      db.payment.findMany({ include: { user: userRef }, orderBy: { createdAt: 'desc' }, take: 50 }),
      db.payment.aggregate({
        where: { createdAt: { gte: since30d }, status: { in: ['paid', 'finished'] } },
        _sum: { amountUsd: true },
      }),
    ])

    const now = Date.now()
    const active = subs.filter((s) => subscriptionIsActive(s, now))
    const dto: AdminPremiumDTO = {
      settings,
      providers: {
        stripe: {
          configured: stripeConfigured(),
          webhookSecret: Boolean(stripeWebhookSecret()),
          products: Object.fromEntries(PLAN_KEYS.map((p) => [p, Boolean(stripeProductFor(p))])),
          webhookUrl: `${origin}/api/webhooks/stripe`,
        },
        nowpayments: {
          configured: nowpaymentsConfigured(),
          sandbox: nowpaymentsSandbox(),
          ipnUrl: `${origin}/api/webhooks/nowpayments`,
        },
      },
      stats: {
        activeUsers: new Set(active.map((s) => s.userId)).size,
        stripe: active.filter((s) => s.provider === 'stripe').length,
        crypto: active.filter((s) => s.provider === 'nowpayments').length,
        admin: active.filter((s) => s.provider === 'admin').length,
        revenue30d: Math.round((revenue._sum.amountUsd ?? 0) * 100) / 100,
      },
      subscriptions: subs.map((s) => ({
        id: s.id,
        user: s.user,
        provider: s.provider,
        plan: s.plan,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        note: s.note,
        createdAt: s.createdAt.toISOString(),
        active: subscriptionIsActive(s, now),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        user: p.user,
        provider: p.provider,
        plan: p.plan,
        amountUsd: p.amountUsd,
        status: p.status,
        payCurrency: p.payCurrency,
        actuallyPaid: p.actuallyPaid,
        createdAt: p.createdAt.toISOString(),
      })),
    }
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** PUT /api/admin/premium — { fields?: {campo: modo}, prices?: {plan: usd|null} } */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const settings = await savePremiumSettings({
      fields: typeof body.fields === 'object' && body.fields ? body.fields : undefined,
      prices: typeof body.prices === 'object' && body.prices ? body.prices : undefined,
    })
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
