import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import {
  PACKS,
  PACK_KEYS,
  activeBoostScores,
  creditAmmo,
  debitAmmo,
  getAmmoSettings,
  saveAmmoSettings,
} from '@/lib/ammo'
import { stripeAmmoAvailable } from '@/lib/stripe'
import type { AdminAmmoDTO } from '@/lib/types'

const userRef = { select: { id: true, handle: true, name: true, avatar: true } } as const

/** GET /api/admin/ammo — configuración de la munición, ventas y boosts vivos. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const since30d = new Date(Date.now() - 30 * 24 * 3600_000)
    const [settings, sold, revenue, circulating, liveBoosts, scores] = await Promise.all([
      getAmmoSettings(),
      db.ammoEntry.aggregate({ where: { reason: 'purchase', createdAt: { gte: since30d } }, _sum: { amount: true } }),
      db.payment.aggregate({
        where: { createdAt: { gte: since30d }, status: { in: ['paid', 'finished'] }, plan: { startsWith: 'ammo_' } },
        _sum: { amountUsd: true },
      }),
      db.user.aggregate({ _sum: { ammo: true } }),
      db.boost.findMany({
        where: { endsAt: { gt: new Date() } },
        include: { user: userRef },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      activeBoostScores(),
    ])

    // Los nombres de los proyectos boosteados, en dos consultas y no en N
    const launchIds = liveBoosts.filter((b) => b.targetType === 'launch').map((b) => b.targetId)
    const tokenIds = liveBoosts.filter((b) => b.targetType === 'token').map((b) => b.targetId)
    const [launches, tokens] = await Promise.all([
      launchIds.length
        ? db.launch.findMany({ where: { id: { in: launchIds } }, select: { id: true, name: true, ticker: true } })
        : [],
      tokenIds.length
        ? db.token.findMany({ where: { id: { in: tokenIds } }, select: { id: true, name: true, ticker: true } })
        : [],
    ])
    const nameOf = new Map<string, string>([
      ...launches.map((l) => [`launch:${l.id}`, l.ticker ?? l.name] as [string, string]),
      ...tokens.map((t) => [`token:${t.id}`, t.ticker] as [string, string]),
    ])

    const now = Date.now()
    const dto: AdminAmmoDTO = {
      settings,
      packs: PACK_KEYS.map((k) => ({ key: k, label: PACKS[k].label, bullets: PACKS[k].bullets })),
      cardAvailable: stripeAmmoAvailable(),
      stats: {
        bulletsSold30d: sold._sum.amount ?? 0,
        revenue30d: Math.round((revenue._sum.amountUsd ?? 0) * 100) / 100,
        bulletsCirculating: circulating._sum.ammo ?? 0,
        activeBoosts: Object.keys(scores).length,
      },
      boosts: liveBoosts.map((b) => ({
        id: b.id,
        user: b.user,
        targetType: b.targetType,
        targetId: b.targetId,
        targetName: nameOf.get(`${b.targetType}:${b.targetId}`) ?? '(borrado)',
        bullets: b.bullets,
        bulletsLeft: Math.max(0, Math.ceil((b.endsAt.getTime() - now) / 60_000)),
        endsAt: b.endsAt.toISOString(),
        createdAt: b.createdAt.toISOString(),
      })),
    }
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** PUT /api/admin/ammo — { prices?, planGifts?, goldenAt?, notifyAt? } */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const settings = await saveAmmoSettings({
      prices: typeof body.prices === 'object' && body.prices ? body.prices : undefined,
      planGifts: typeof body.planGifts === 'object' && body.planGifts ? body.planGifts : undefined,
      goldenAt: body.goldenAt,
      notifyAt: body.notifyAt,
    })
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/admin/ammo — { handle, bullets, note? }
 * Regala (o quita, con un número negativo) balas a una cuenta. Para premios,
 * acuerdos con proyectos y arreglar pagos que se torcieron.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const handle = String(body.handle ?? '').replace(/^@/, '').trim()
    const bullets = Math.floor(Number(body.bullets))
    if (!handle) return NextResponse.json({ error: 'Falta el usuario' }, { status: 400 })
    if (!Number.isFinite(bullets) || bullets === 0 || Math.abs(bullets) > 1_000_000) {
      return NextResponse.json({ error: 'Número de balas no válido' }, { status: 400 })
    }
    const user = await db.user.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { id: true, handle: true, ammo: true },
    })
    if (!user) return NextResponse.json({ error: `No existe @${handle}` }, { status: 404 })

    const note = String(body.note ?? '').slice(0, 200)
    const ok =
      bullets > 0
        ? await creditAmmo(user.id, bullets, { reason: 'admin', note })
        : await debitAmmo(user.id, -bullets, note)
    if (!ok) {
      return NextResponse.json({ error: `@${user.handle} no tiene tantas balas que quitar` }, { status: 400 })
    }
    const after = await db.user.findUnique({ where: { id: user.id }, select: { ammo: true } })
    return NextResponse.json({ ok: true, handle: user.handle, balance: after?.ammo ?? 0 })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
