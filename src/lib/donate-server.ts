import { db } from '@/lib/db'
import { awardPoints, getPointRules } from '@/lib/api-helpers'
import { CABAL_X_HANDLE } from '@/lib/cabal-x'
import {
  DONATE_POINTS_PER_USD,
  DONATE_SHARE_BONUS,
  donationPoints,
  fmtUsd,
  type DonateShareVariant,
  type DonationDTO,
} from '@/lib/donate'
import { DEFAULT_LOCALE, toLocale, type Locale } from '@/lib/share-card'
import { siteUrl } from '@/lib/waitlist'

/**
 * Parte de las donaciones que toca la base de datos y compone las URLs.
 *
 * Cómo funciona una donación de punta a punta:
 *  1. La persona elige el importe y POST /api/donate crea un Payment con plan
 *     'donation' y una factura de NOWPayments cuyo order_id es ese Payment.id.
 *  2. Paga en la moneda que quiera. Cuando la red confirma, la notificación
 *     (IPN) llega a /api/webhooks/nowpayments, que comprueba el importe contra
 *     la API y llama a `creditDonation`.
 *  3. `creditDonation` deja el recibo (Donation, con paymentId único) y abona
 *     los puntos: `points_per_usd_donated` por cada dólar confirmado.
 *  4. Al volver del pago, /app?donated=<id> abre la pantalla de gracias con la
 *     tarjeta para X. Publicarla suma el bonus `points_share_donation`, una vez
 *     por donación.
 *
 * Los puntos salen del importe CONFIRMADO por el proveedor, nunca del que dijo
 * el navegador: el dinero manda sobre el mensaje, igual que en Premium.
 */

/** Plan con el que se marcan los Payment de una donación. */
export const DONATION_PLAN = 'donation'

// ---------- Reglas editables ----------
/** Puntos por dólar donado y bonus por compartir, según las reglas vigentes. */
export async function donateRules(): Promise<{ perUsd: number; shareBonus: number }> {
  const rules = await getPointRules()
  return {
    perUsd: rules.points_per_usd_donated ?? DONATE_POINTS_PER_USD,
    shareBonus: rules.points_share_donation ?? DONATE_SHARE_BONUS,
  }
}

// ---------- Enlaces ----------
/**
 * Enlace que acompaña al post de la donación: /d/<handle> (y /d/<handle>/en).
 *
 * Ruta propia y no /r ni /f por lo mismo que la campaña de seguir: X guarda UNA
 * tarjeta por URL y no hay forma de refrescarla, así que cada campaña necesita
 * su enlace para que cada post lleve su imagen. Quien entra por aquí queda
 * igualmente registrado como invitado de <handle>.
 */
export function donateRefUrl(handle?: string | null, locale: Locale = DEFAULT_LOCALE): string {
  if (!handle) return siteUrl()
  const l = toLocale(locale)
  const base = `${siteUrl()}/d/${encodeURIComponent(handle)}`
  return l === DEFAULT_LOCALE ? base : `${base}/${l}`
}

/** Imagen Open Graph de ese enlace: /api/donate/card/<handle>.<idioma>.jpg */
export function donateCardUrl(handle: string, locale: Locale = DEFAULT_LOCALE): string {
  return `${siteUrl()}/api/donate/card/${encodeURIComponent(handle)}.${toLocale(locale)}.jpg`
}

// ---------- Texto del post ----------
/**
 * El post no dice cuánto se donó, a propósito: lo que suma a la comunidad es
 * que se sepa que la plataforma la sostiene la gente, no la cifra de cada uno
 * (y quien dona $2 debe poder compartirlo igual de orgulloso que quien dona
 * $200).
 */
export const DONATE_SHARE_TEXT: Record<Locale, string> = {
  es: [
    `Acabo de donar a @${CABAL_X_HANDLE} 🫡 Me gusta el proyecto: el radar donde la comunidad ve los memecoins ANTES de que salgan, gratis y sin anuncios.`,
    '',
    'Lo sostenemos entre todos. Si lo usas, dona lo que puedas:',
  ].join('\n'),
  en: [
    `Just donated to @${CABAL_X_HANDLE} 🫡 I like this project: the radar where the community spots memecoins BEFORE they launch, free and ad-free.`,
    '',
    'The community keeps it alive. If you use it, chip in:',
  ].join('\n'),
}

export function donateShareText(locale: Locale = DEFAULT_LOCALE): string {
  return DONATE_SHARE_TEXT[toLocale(locale)]
}

/** Intent de publicación con el texto y el enlace ya rellenados. */
export function donateShareIntentUrl(
  handle?: string | null,
  locale: Locale = DEFAULT_LOCALE
): string {
  const params = new URLSearchParams({
    text: donateShareText(locale),
    url: donateRefUrl(handle, locale),
  })
  return `https://x.com/intent/post?${params.toString()}`
}

export function donateVariants(handle?: string | null): Record<Locale, DonateShareVariant> {
  const build = (locale: Locale): DonateShareVariant => ({
    text: donateShareText(locale),
    url: donateRefUrl(handle, locale),
    intent: donateShareIntentUrl(handle, locale),
    card: handle ? donateCardUrl(handle, locale) : `${siteUrl()}/og-cabal.png`,
  })
  return { es: build('es'), en: build('en') }
}

// ---------- Abono de los puntos ----------
/**
 * Deja el recibo de una donación confirmada y abona sus puntos. La llama el
 * webhook DESPUÉS de comprobar el importe con la API del proveedor.
 *
 * Idempotente: Donation.paymentId es único, así que una notificación repetida
 * se encuentra el recibo hecho y no vuelve a pagar. Devuelve null si ya estaba
 * abonada.
 */
export async function creditDonation(payment: {
  id: string
  userId: string
  amountUsd: number
}): Promise<{ points: number } | null> {
  const { perUsd } = await donateRules()
  const points = donationPoints(payment.amountUsd, perUsd)

  const donation = await db.donation
    .create({
      data: { userId: payment.userId, paymentId: payment.id, amountUsd: payment.amountUsd, points },
    })
    .catch((e: { code?: string }) => {
      if (e?.code === 'P2002') return null // ya abonada por una notificación anterior
      throw e
    })
  if (!donation) return null

  if (points > 0) {
    await awardPoints(payment.userId, 'donation', `Donación de ${fmtUsd(payment.amountUsd)}`, points)
  }
  return { points }
}

/**
 * Abona el bonus por publicar la tarjeta de una donación en X.
 *
 * Solo se cobra una vez por donación y solo si el pago está confirmado: sin eso
 * bastaría con abrir una factura que nunca se paga para cobrar el bonus. No se
 * comprueba en la API de X que el post exista, igual que en el resto de las
 * campañas (ver la nota en lib/follow-x.ts).
 */
export async function claimDonationShare(
  userId: string,
  donationId: string
): Promise<{ pointsEarned: number; shared: boolean }> {
  const donation = await db.donation.findFirst({ where: { id: donationId, userId } })
  if (!donation) throw new Error('Esa donación no es de tu cuenta')
  if (donation.sharedAt) return { pointsEarned: 0, shared: true }

  const { shareBonus } = await donateRules()
  // Se marca primero y solo si seguía sin marcar: dos clics seguidos (o dos
  // pestañas) no pueden cobrar el bonus dos veces.
  const marked = await db.donation.updateMany({
    where: { id: donation.id, sharedAt: null },
    data: { sharedAt: new Date(), sharePoints: shareBonus },
  })
  if (marked.count === 0) return { pointsEarned: 0, shared: true }

  const pointsEarned = shareBonus > 0
    ? await awardPoints(userId, 'share_donation', 'Compartió su donación en X', shareBonus)
    : 0
  return { pointsEarned, shared: true }
}

// ---------- DTO para la interfaz ----------
/**
 * Estado de una donación tal y como lo pinta la pantalla de gracias. `payment`
 * es la factura y `donation` el recibo, que solo existe cuando ya se confirmó.
 */
export async function donationDTO(opts: {
  handle: string
  locale: Locale
  payment: { id: string; amountUsd: number; status: string; invoiceUrl: string | null }
  donation: { points: number; sharedAt: Date | null } | null
}): Promise<DonationDTO> {
  const { perUsd, shareBonus } = await donateRules()
  const confirmed = Boolean(opts.donation)
  return {
    id: opts.payment.id,
    amountUsd: opts.payment.amountUsd,
    status: opts.payment.status,
    confirmed,
    // Confirmada: los puntos que se abonaron de verdad. Pendiente: los que va a
    // recibir si la red confirma, con las reglas de ahora.
    points: opts.donation?.points ?? donationPoints(opts.payment.amountUsd, perUsd),
    shareBonus,
    shared: Boolean(opts.donation?.sharedAt),
    handle: opts.handle,
    locale: toLocale(opts.locale),
    share: donateVariants(opts.handle),
    invoiceUrl: opts.payment.invoiceUrl,
  }
}

/**
 * Última donación de la persona con algo pendiente: confirmarse o compartir su
 * tarjeta. Es lo que hace que el bonus por compartir no se pierda si cierra la
 * pantalla de gracias — el diálogo de donar se lo vuelve a ofrecer.
 */
export async function pendingDonation(userId: string, locale: Locale): Promise<DonationDTO | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { handle: true } })
  if (!user) return null

  // Recibo cobrado al que le falta el bonus de compartir.
  const donation = await db.donation.findFirst({
    where: { userId, sharedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (donation) {
    const payment = await db.payment.findUnique({ where: { id: donation.paymentId } })
    if (!payment) return null
    return donationDTO({ handle: user.handle, locale, payment, donation })
  }

  // Sin recibo: una factura de donación reciente que la red aún no confirmó.
  // Solo la última hora, para no arrastrar facturas viejas que nunca se pagaron.
  const payment = await db.payment.findFirst({
    where: {
      userId,
      plan: DONATION_PLAN,
      status: { notIn: ['finished', 'failed', 'expired', 'refunded'] },
      createdAt: { gte: new Date(Date.now() - 3600_000) },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!payment) return null
  return donationDTO({ handle: user.handle, locale, payment, donation: null })
}
