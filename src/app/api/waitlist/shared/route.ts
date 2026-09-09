import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints } from '@/lib/api-helpers'
import { SHARE_BONUS, WAITLIST_COOKIE, readWaitlistCookie, shareRuleAmount } from '@/lib/waitlist'

/**
 * POST /api/waitlist/shared
 * Marca que el usuario abrió el compositor de X para publicar su tarjeta y le
 * abona el bonus por difundir (una sola vez). Ese abono, como cualquier otro,
 * reparte el 10% configurado a quien lo invitó: de ahí sale la comisión de
 * afiliado del que compartió antes que él.
 */
export async function POST() {
  const store = await cookies()
  const entryId = readWaitlistCookie(store.get(WAITLIST_COOKIE)?.value)
  if (!entryId) return NextResponse.json({ error: 'No estás en la lista' }, { status: 401 })

  const entry = await db.waitlistEntry.findUnique({ where: { id: entryId } })
  if (!entry) return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
  if (entry.shared) {
    return NextResponse.json({ ok: true, shared: true, pointsEarned: 0 })
  }

  await db.waitlistEntry.update({
    where: { id: entryId },
    data: { shared: true, sharedAt: new Date() },
  })

  // Solo puntúa si el registro está completo y tiene cuenta Cabal asociada
  let pointsEarned = 0
  if (entry.userId && entry.completed) {
    const prior = await db.pointEvent.findFirst({ where: { userId: entry.userId, reason: 'share_x' } })
    if (!prior) {
      pointsEarned = await awardPoints(
        entry.userId,
        'share_x',
        'Compartió su tarjeta de Cabal.army en X',
        await shareRuleAmount()
      )
    }
  }

  return NextResponse.json({ ok: true, shared: true, pointsEarned, bonus: SHARE_BONUS })
}
