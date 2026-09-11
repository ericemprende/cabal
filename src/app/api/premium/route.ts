import { NextResponse } from 'next/server'
import { PLAN_KEYS, PLANS, getPremiumSettings, getViewer, premiumStatus } from '@/lib/premium'
import { stripePlanAvailable } from '@/lib/stripe'
import { nowpaymentsConfigured } from '@/lib/nowpayments'
import type { PremiumInfoDTO, PremiumPlanDTO } from '@/lib/types'

/**
 * GET /api/premium — planes a la venta, pasarelas disponibles y el estado
 * premium de quien pregunta. Lo usa el diálogo de suscripción.
 */
export async function GET(req: Request) {
  try {
    const [viewer, settings] = await Promise.all([getViewer(req), getPremiumSettings()])
    const monthly = settings.prices.monthly
    const crypto = nowpaymentsConfigured()

    const plans: PremiumPlanDTO[] = PLAN_KEYS.flatMap((key) => {
      const price = settings.prices[key]
      if (price === null) return []
      const { label, months } = PLANS[key]
      // Ahorro frente a pagar el mensual todos esos meses (anual a $228 = 24% con el mensual a $25)
      const savingsPct =
        monthly && key !== 'monthly' ? Math.max(0, Math.round((1 - price / (monthly * months)) * 100)) : 0
      return [
        {
          key,
          label,
          priceUsd: price,
          months,
          perMonthUsd: Math.round((price / months) * 100) / 100,
          savingsPct,
          card: stripePlanAvailable(key),
          crypto,
        },
      ]
    })

    const dto: PremiumInfoDTO = {
      loggedIn: Boolean(viewer.userId),
      status: await premiumStatus(viewer.userId, viewer.isAdmin),
      plans,
      fields: settings.fields,
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
