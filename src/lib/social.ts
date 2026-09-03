import { db } from '@/lib/db'
import { awardPoints } from '@/lib/api-helpers'

/**
 * Lógica compartida de vinculación social (X / Google).
 * La usan tanto el flujo demo (/api/me/verify) como los callbacks OAuth reales
 * (/api/auth/x/callback y /api/auth/google/callback).
 */

export const VERIFY_BONUS = 5

export type SocialProvider = 'x' | 'google'

export class SocialError extends Error {}

/** Vincula el handle/email oficial del proveedor al usuario y otorga bonus una sola vez. */
export async function linkProvider(
  userId: string,
  provider: SocialProvider,
  rawValue: string
): Promise<{ pointsEarned: number }> {
  const value = rawValue.trim()

  if (provider === 'x') {
    const handle = value.replace(/^@+/, '')
    if (!/^[\w]{1,15}$/.test(handle)) {
      throw new SocialError('Handle de X inválido (1-15 caracteres)')
    }
    await db.user.update({
      where: { id: userId },
      data: { xHandle: handle, xVerified: true },
    })
    const pointsEarned = await awardOnce(userId, 'verify_x', 'Cuenta de X verificada')
    return { pointsEarned }
  }

  const email = value.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new SocialError('Email de Google inválido')
  }
  await db.user.update({
    where: { id: userId },
    data: { googleEmail: email, googleVerified: true },
  })
  const pointsEarned = await awardOnce(userId, 'verify_google', 'Cuenta de Google verificada')
  return { pointsEarned }
}

/** Desconecta el proveedor del usuario. */
export async function unlinkProvider(userId: string, provider: SocialProvider) {
  const data =
    provider === 'x'
      ? { xHandle: null, xVerified: false }
      : { googleEmail: null, googleVerified: false }
  await db.user.update({ where: { id: userId }, data })
}

/** Bonus de verificación: una sola vez por proveedor. */
async function awardOnce(
  userId: string,
  reason: 'verify_x' | 'verify_google',
  note: string
): Promise<number> {
  const prior = await db.pointEvent.findFirst({ where: { userId, reason } })
  if (prior) return 0
  return awardPoints(userId, reason, note, VERIFY_BONUS)
}
