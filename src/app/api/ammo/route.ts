import { NextResponse } from 'next/server'
import { ammoBalance, getAmmoSettings, packsFor, promoActive } from '@/lib/ammo'
import { getViewer } from '@/lib/premium'
import { stripeAmmoAvailable } from '@/lib/stripe'
import { nowpaymentsConfigured } from '@/lib/nowpayments'
import type { AmmoInfoDTO } from '@/lib/types'

/**
 * GET /api/ammo — saldo de balas de quien mira y cargadores a la venta.
 * Un visitante sin cuenta también lo ve (con saldo 0): así puede mirar los
 * precios antes de registrarse.
 */
export async function GET(req: Request) {
  try {
    const viewer = await getViewer(req)
    const [settings, balance] = await Promise.all([getAmmoSettings(), ammoBalance(viewer.userId)])
    const dto: AmmoInfoDTO = {
      loggedIn: Boolean(viewer.userId),
      balance,
      packs: packsFor(settings, { card: stripeAmmoAvailable(), crypto: nowpaymentsConfigured() }),
      goldenAt: settings.goldenAt,
      planGifts: settings.planGifts,
      promo: promoActive(settings) ? { pct: settings.promoPct, until: settings.promoUntil } : null,
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
