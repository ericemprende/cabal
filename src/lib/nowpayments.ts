import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Cobro en cripto con NOWPayments (factura alojada, pago único).
 *
 * Variables de entorno:
 *  - NOWPAYMENTS_API_KEY     clave de la API
 *  - NOWPAYMENTS_IPN_SECRET  secreto con el que firman las notificaciones (IPN)
 *  - NOWPAYMENTS_API_URL     opcional; https://api-sandbox.nowpayments.io/v1 para pruebas
 *
 * La URL de notificación va en cada factura (ipn_callback_url), así que no hay
 * que configurarla en su panel.
 */

const DEFAULT_API = 'https://api.nowpayments.io/v1'

function apiKey(): string | null {
  return process.env.NOWPAYMENTS_API_KEY?.trim() || null
}

function ipnSecret(): string | null {
  return process.env.NOWPAYMENTS_IPN_SECRET?.trim() || null
}

function apiUrl(): string {
  return (process.env.NOWPAYMENTS_API_URL?.trim() || DEFAULT_API).replace(/\/+$/, '')
}

export function nowpaymentsConfigured(): boolean {
  return Boolean(apiKey() && ipnSecret())
}

export function nowpaymentsSandbox(): boolean {
  return apiUrl().includes('sandbox')
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const key = apiKey()
  if (!key) throw new Error('NOWPayments no está configurado')
  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { 'x-api-key': key, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json().catch(() => ({}))) as T & { message?: string }
  if (!res.ok) throw new Error(`NOWPayments ${res.status}: ${json.message ?? 'error desconocido'}`)
  return json
}

/** Crea la factura y devuelve su id y la URL donde el usuario elige moneda y paga. */
export async function createNowInvoice(p: {
  orderId: string
  amountUsd: number
  description: string
  ipnUrl: string
  successUrl: string
  cancelUrl: string
}): Promise<{ id: string; url: string }> {
  const json = await call<{ id?: string | number; invoice_url?: string }>('/invoice', {
    method: 'POST',
    body: JSON.stringify({
      price_amount: p.amountUsd,
      price_currency: 'usd',
      order_id: p.orderId,
      order_description: p.description,
      ipn_callback_url: p.ipnUrl,
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
    }),
  })
  if (!json.id || !json.invoice_url) throw new Error('NOWPayments no devolvió la factura')
  return { id: String(json.id), url: json.invoice_url }
}

export type NowPayment = {
  payment_id: string | number
  payment_status: string
  order_id?: string | null
  price_amount?: number | string
  price_currency?: string
  pay_currency?: string
  actually_paid?: number | string
}

/** Estado de un pago consultado directamente a la API (fuente de verdad). */
export function fetchNowPayment(paymentId: string): Promise<NowPayment> {
  return call<NowPayment>(`/payment/${encodeURIComponent(paymentId)}`)
}

/** Ordena las claves en todos los niveles: así serializa NOWPayments lo que firma. */
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep)
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>
    return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortDeep(obj[k])]))
  }
  return v
}

/**
 * Firma de la IPN: HMAC-SHA512 (hex) del cuerpo con las claves ordenadas, con
 * el secreto IPN, en la cabecera x-nowpayments-sig. El orden tiene que ser
 * recursivo: el ejemplo que circula (`JSON.stringify(obj, Object.keys(obj).sort())`)
 * descarta las claves anidadas y falla con cualquier IPN que traiga objetos.
 */
export function verifyNowSignature(payload: unknown, signature: string | null): boolean {
  const secret = ipnSecret()
  if (!secret || !signature) return false
  const expected = createHmac('sha512', secret).update(JSON.stringify(sortDeep(payload))).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature.trim().toLowerCase())
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Estados en los que el pago ya no va a cambiar. */
export const NOW_FINAL = new Set(['finished', 'failed', 'refunded', 'expired'])
