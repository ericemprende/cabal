import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getXConfig } from '@/lib/oauth'
import {
  WAITLIST_COOKIE,
  readWaitlistCookie,
  localeFromHeader,
  shareVariants,
  SHARE_BONUS,
  waitlistPosition,
  type WaitlistStatusDTO,
} from '@/lib/waitlist'

export const dynamic = 'force-dynamic'

/**
 * GET /api/waitlist/me
 * Estado de la lista para el visitante actual: en qué paso está (login →
 * formulario → dentro), su posición y el post que puede compartir en X.
 */
export async function GET() {
  const store = await cookies()
  const locale = localeFromHeader((await headers()).get('accept-language'))
  const entryId = readWaitlistCookie(store.get(WAITLIST_COOKIE)?.value)
  const entry = entryId ? await db.waitlistEntry.findUnique({ where: { id: entryId } }) : null
  // Solo cuentan los registros terminados: los que se quedaron en el paso 2 no
  const total = await db.waitlistEntry.count({ where: { completed: true } })

  const payload: WaitlistStatusDTO = {
    step: !entry ? 'login' : entry.completed ? 'done' : 'form',
    configured: Boolean(getXConfig()),
    total,
    locale,
    share: shareVariants(entry?.xHandle, entry?.xId),
    shareBonus: SHARE_BONUS,
    ...(entry
      ? {
          entry: {
            id: entry.id,
            xHandle: entry.xHandle,
            xName: entry.xName,
            xAvatar: entry.xAvatar,
            xVerified: entry.xVerified,
            xFollowers: entry.xFollowers,
            email: entry.email,
            telegram: entry.telegram,
            wallet: entry.wallet,
            country: entry.country,
            reason: entry.reason,
            status: entry.status,
            completed: entry.completed,
            shared: entry.shared,
            position: await waitlistPosition(entry.createdAt),
            createdAt: entry.createdAt.toISOString(),
          },
        }
      : {}),
  }
  return NextResponse.json(payload)
}
