import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { handleStripeEvent, stripe, stripeConfigured, stripeWebhookSecret } from '@/lib/stripe'

/**
 * POST /api/webhooks/stripe
 * Eventos: checkout.session.completed, customer.subscription.created/updated/
 * deleted, invoice.paid e invoice.payment_failed.
 *
 * La firma se comprueba sobre el cuerpo tal cual llega (req.text()): si se
 * parsea antes, el JSON cambia y la firma deja de cuadrar. Un fallo al procesar
 * devuelve 500 para que Stripe lo reintente; todo lo que se hace es idempotente.
 */
export async function POST(req: Request) {
  const secret = stripeWebhookSecret()
  if (!secret || !stripeConfigured()) {
    return NextResponse.json({ error: 'Stripe no está configurado' }, { status: 503 })
  }

  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(payload, req.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return NextResponse.json({ error: 'Firma no válida' }, { status: 400 })
  }

  try {
    await handleStripeEvent(event)
    return NextResponse.json({ received: true })
  } catch (e) {
    console.error(`[stripe] ${event.type} ${event.id}`, e)
    return NextResponse.json({ error: 'Error al procesar el evento' }, { status: 500 })
  }
}
