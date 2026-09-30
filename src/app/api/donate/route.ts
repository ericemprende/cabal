import { headers } from 'next/headers'
import { blockIosAppPurchase } from '@/lib/native-app'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { appOrigin } from '@/lib/oauth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { createNowInvoice, nowpaymentsConfigured } from '@/lib/nowpayments'
import {
  DONATE_MAX_USD,
  DONATE_MIN_USD,
  DONATE_PRESETS,
  donationPoints,
  fmtUsd,
  normalizeDonationAmount,
  normalizeDonationCurrency,
  type DonateConfigDTO,
} from '@/lib/donate'
import { DONATION_PLAN, donateRules, pendingDonation } from '@/lib/donate-server'
import { localeFromHeader } from '@/lib/waitlist'

export const dynamic = 'force-dynamic'

/**
 * GET /api/donate — lo que el diálogo de donar necesita para pintarse: importes
 * sugeridos, cuántos puntos da cada dólar y si hay algo pendiente de la última
 * donación (confirmarse o compartir su tarjeta).
 */
export async function GET() {
  try {
    const userId = await sessionUserIdFromCookies().catch(() => null)
    const locale = localeFromHeader((await headers()).get('accept-language'))
    const { perUsd, shareBonus } = await donateRules()
    const dto: DonateConfigDTO = {
      invoices: nowpaymentsConfigured(),
      signedIn: Boolean(userId),
      presets: [...DONATE_PRESETS],
      minUsd: DONATE_MIN_USD,
      maxUsd: DONATE_MAX_USD,
      pointsPerUsd: perUsd,
      shareBonus,
      last: userId ? await pendingDonation(userId, locale) : null,
    }
    return NextResponse.json(dto)
  } catch (e) {
    console.error('[donate] config', e)
    return NextResponse.json({ error: 'No se pudo cargar la donación' }, { status: 500 })
  }
}

/**
 * POST /api/donate — { amountUsd, currency? }
 * Abre una factura de NOWPayments por ese importe y devuelve { url } para
 * pagarla. `currency` es el ticker que el diálogo dejó elegido (Solana por
 * defecto) y sale ya montada en esa moneda; con '' se elige en la pasarela. El Payment se crea antes: su id viaja como order_id y es lo que la
 * notificación del proveedor nos devuelve para abonar los puntos (ver
 * lib/donate-server.ts).
 *
 * Hace falta sesión: sin cuenta no hay a quién abonarle los puntos. Quien no la
 * tiene sigue teniendo el widget del diálogo, que cobra igual pero no puntúa.
 */
export async function POST(req: Request) {
  const blocked = blockIosAppPurchase(req)
  if (blocked) return blocked
  try {
    const userId = await sessionUserIdFromCookies().catch(() => null)
    if (!userId) {
      return NextResponse.json({ error: 'Inicia sesión para ganar puntos por tu donación' }, { status: 401 })
    }
    const limit = await rateLimit(`donate:${userId}`, 10, 60)
    if (!limit.ok) return tooManyRequests(limit)

    if (!nowpaymentsConfigured()) {
      return NextResponse.json({ error: 'Las donaciones en cripto no están disponibles ahora mismo' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const amountUsd = normalizeDonationAmount(body?.amountUsd)
    const currency = normalizeDonationCurrency(body?.currency)
    if (amountUsd === null) {
      return NextResponse.json(
        { error: `Elige un importe entre ${fmtUsd(DONATE_MIN_USD)} y ${fmtUsd(DONATE_MAX_USD)}` },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

    const origin = appOrigin(req)
    const payment = await db.payment.create({
      data: {
        userId: user.id,
        provider: 'nowpayments',
        plan: DONATION_PLAN,
        amountUsd,
        status: 'waiting',
        // La elegida aquí; la notificación la sobrescribe con la que se pagó
        // de verdad (se puede cambiar en la pasarela).
        payCurrency: currency || null,
      },
    })
    try {
      const invoice = await createNowInvoice({
        orderId: payment.id,
        amountUsd,
        description: `Donación a Cabal · ${fmtUsd(amountUsd)}`,
        ipnUrl: `${origin}/api/webhooks/nowpayments`,
        // Al volver, /app abre la pantalla de gracias con la tarjeta para X.
        successUrl: `${origin}/app?donated=${payment.id}`,
        cancelUrl: `${origin}/app?donated=cancel`,
        payCurrency: currency,
      })
      await db.payment.update({
        where: { id: payment.id },
        data: {
          externalId: invoice.id,
          invoiceUrl: invoice.url,
          // Si la pasarela no aceptó la moneda, la factura sale abierta.
          payCurrency: invoice.payCurrency,
        },
      })
      const { perUsd } = await donateRules()
      return NextResponse.json({
        url: invoice.url,
        donationId: payment.id,
        points: donationPoints(amountUsd, perUsd),
      })
    } catch (e) {
      await db.payment.delete({ where: { id: payment.id } }).catch(() => {})
      throw e
    }
  } catch (e) {
    console.error('[donate] checkout', e)
    return NextResponse.json({ error: 'No se pudo abrir la donación. Inténtalo de nuevo.' }, { status: 502 })
  }
}
