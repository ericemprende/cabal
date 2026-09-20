import { db } from '@/lib/db'
import { AFFILIATE_PRESETS } from '@/lib/affiliate'

/**
 * La parte de las plataformas afiliadas que toca la base de datos.
 *
 * Vive aparte de lib/affiliate a propósito: de ahí salen constantes y
 * funciones puras que usan componentes del navegador (la ficha del token, el
 * panel admin). Mientras ese archivo importaba `db`, el paquete del navegador
 * arrastraba Prisma y la app petaba al cargar ("client-side exception").
 */

/** Garantiza que los presets existan (idempotente, corre una sola vez por BD vacía). */
export async function ensureAffiliatePresets() {
  const count = await db.affiliatePlatform.count()
  if (count > 0) return
  await db.affiliatePlatform.createMany({
    data: AFFILIATE_PRESETS.map((p) => ({ ...p, url: '', links: '{}', active: false })),
  })
}
