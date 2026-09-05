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

/**
 * Login/registro social: busca al usuario por su identidad del proveedor y, si
 * no existe, crea la cuenta automáticamente (identidad verificada de serie).
 * La usan el login social real (callbacks OAuth con mode=login) y el demo
 * (/api/auth/social).
 */
export async function loginOrCreateSocial(
  provider: SocialProvider,
  rawValue: string,
  profileName?: string
): Promise<{ user: { id: string }; created: boolean }> {
  const value = rawValue.trim()

  if (provider === 'x') {
    const handle = value.replace(/^@+/, '')
    if (!/^[\w]{1,15}$/.test(handle)) {
      throw new SocialError('Handle de X inválido (1-15 caracteres)')
    }
    const existing = await db.user.findFirst({ where: { xHandle: handle } })
    if (existing) return { user: existing, created: false }
    const user = await db.user.create({
      data: {
        handle: await uniqueHandle(handle),
        name: (profileName?.trim() || handle).slice(0, 40),
        xHandle: handle,
        xVerified: true,
      },
    })
    await awardOnce(user.id, 'verify_x', 'Cuenta de X verificada')
    return { user, created: true }
  }

  const email = value.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new SocialError('Email de Google inválido')
  }
  const existing = await db.user.findFirst({ where: { googleEmail: email } })
  if (existing) return { user: existing, created: false }
  const base = email.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 18) || 'user'
  const user = await db.user.create({
    data: {
      handle: await uniqueHandle(base),
      name: (profileName?.trim() || base).slice(0, 40),
      googleEmail: email,
      googleVerified: true,
    },
  })
  await awardOnce(user.id, 'verify_google', 'Cuenta de Google verificada')
  return { user, created: true }
}

/** Handle único y válido: base, base2, base3… (reglas: 3-20 chars [a-z0-9_]). */
async function uniqueHandle(baseRaw: string): Promise<string> {
  let base = baseRaw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18)
  if (base.length < 3) base = `${base}cabal`.slice(0, 12)
  if (!/^[a-z0-9_]{3,20}$/.test(base)) base = 'cabal'
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i + 1}`
    const taken = await db.user.findUnique({ where: { handle: candidate } })
    if (!taken) return candidate
  }
  return `cabal${Date.now().toString(36).slice(-6)}`
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
