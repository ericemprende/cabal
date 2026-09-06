import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { getCurrentUser, getReferralPercent } from '@/lib/api-helpers'

// GET /api/me/referral — código de invitación del usuario (se genera la 1ª vez)
// + estadísticas: invitados, puntos ganados por referidos y % configurado.
export async function GET() {
  try {
    const me = await getCurrentUser()

    let code = me.referralCode
    if (!code) {
      // Genera un código único tipo CABAL-XXXXXX (evitando 0/O y 1/I)
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      for (let attempt = 0; attempt < 10; attempt++) {
        const bytes = randomBytes(6)
        const candidate = Array.from(bytes)
          .map((b) => alphabet[b % alphabet.length])
          .join('')
        const taken = await db.user.findUnique({ where: { referralCode: candidate } })
        if (!taken) {
          code = candidate
          await db.user.update({ where: { id: me.id }, data: { referralCode: code } })
          break
        }
      }
    }

    const [referrals, earned, percent] = await Promise.all([
      db.user.count({ where: { referredById: me.id } }),
      db.pointEvent.aggregate({
        where: { userId: me.id, reason: 'referral' },
        _sum: { amount: true },
      }),
      getReferralPercent(),
    ])

    return NextResponse.json({
      code: code ?? '',
      referrals,
      earned: earned._sum.amount ?? 0,
      percent,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
