import { db } from '@/lib/db'
import { awardPoints, getPointRules } from '@/lib/api-helpers'
import { queueGhlSync } from '@/lib/ghl'

/**
 * Lógica compartida de vinculación social (X / Google).
 * La usan tanto el flujo demo (/api/me/verify) como los callbacks OAuth reales
 * (/api/auth/x/callback y /api/auth/google/callback).
 */

export const VERIFY_BONUS = 5

export type SocialProvider = 'x' | 'google' | 'discord'

export class SocialError extends Error {}

/** Vincula el handle/email oficial del proveedor al usuario y otorga bonus una sola vez. */
export async function linkProvider(
  userId: string,
  provider: SocialProvider,
  rawValue: string,
  photoUrl?: string,
  /** Solo en Discord: el nombre visible, que no se puede deducir del id. */
  displayName?: string
): Promise<{ pointsEarned: number }> {
  const value = rawValue.trim()

  if (provider === 'x') {
    const handle = value.replace(/^@+/, '')
    if (!/^[\w]{1,15}$/.test(handle)) {
      throw new SocialError('Handle de X inválido (1-15 caracteres)')
    }
    const current = await db.user.findUnique({ where: { id: userId }, select: { avatar: true } })
    const avatar = xPhotoFor(current?.avatar, photoUrl)
    await db.user.update({
      where: { id: userId },
      data: { xHandle: handle, xVerified: true, ...(avatar && { avatar }) },
    })
    const pointsEarned = await awardOnce(userId, 'verify_x', 'Cuenta de X verificada')
    return { pointsEarned }
  }

  if (provider === 'discord') {
    // El id de Discord es un snowflake: solo dígitos, 17-20 hoy.
    if (!/^\d{15,25}$/.test(value)) {
      throw new SocialError('Cuenta de Discord inválida')
    }
    // Una cuenta de Discord no puede verificar dos cuentas de Cabal: si no,
    // los puntos por verificar se cobrarían una vez por cada cuenta creada.
    const taken = await db.user.findFirst({
      where: { discordId: value, NOT: { id: userId } },
      select: { id: true },
    })
    if (taken) throw new SocialError('Esa cuenta de Discord ya está vinculada a otro perfil')
    await db.user.update({
      where: { id: userId },
      data: { discordId: value, discordName: displayName?.trim().slice(0, 64) || null, discordVerified: true },
    })
    const pointsEarned = await awardOnce(userId, 'verify_discord', 'Cuenta de Discord verificada')
    return { pointsEarned }
  }

  const email = value.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new SocialError('Email de Google inválido')
  }
  const updated = await db.user.update({
    where: { id: userId },
    data: { googleEmail: email, googleVerified: true },
  })
  // El correo de GHL sale de user.email (el que se verifica con código), no de
  // googleEmail: si aún no tiene uno propio, éste le sirve de punto de partida.
  if (!updated.email) {
    await db.user.update({ where: { id: userId }, data: { email } }).catch(() => {})
  }
  queueGhlSync(userId)
  const pointsEarned = await awardOnce(userId, 'verify_google', 'Cuenta de Google verificada')
  return { pointsEarned }
}

/** Desconecta el proveedor del usuario. */
export async function unlinkProvider(userId: string, provider: SocialProvider) {
  const data =
    provider === 'x'
      ? { xHandle: null, xVerified: false }
      : provider === 'discord'
        ? { discordId: null, discordName: null, discordVerified: false }
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
  /** Discord no entra aquí: con `identify` no hay correo con el que crear cuenta. */
  provider: 'x' | 'google',
  rawValue: string,
  profileName?: string,
  photoUrl?: string
): Promise<{ user: { id: string }; created: boolean }> {
  const value = rawValue.trim()

  if (provider === 'x') {
    const handle = value.replace(/^@+/, '')
    if (!/^[\w]{1,15}$/.test(handle)) {
      throw new SocialError('Handle de X inválido (1-15 caracteres)')
    }
    const existing = await db.user.findFirst({ where: { xHandle: handle } })
    if (existing) {
      const avatar = xPhotoFor(existing.avatar, photoUrl)
      if (avatar) await db.user.update({ where: { id: existing.id }, data: { avatar } })
      return { user: existing, created: false }
    }
    const avatar = xPhotoFor(null, photoUrl)
    const user = await db.user.create({
      data: {
        handle: await uniqueHandle(handle),
        name: (profileName?.trim() || handle).slice(0, 40),
        xHandle: handle,
        xVerified: true,
        ...(avatar && { avatar }),
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
  if (!user.email) {
    await db.user.update({ where: { id: user.id }, data: { email } }).catch(() => {})
  }
  queueGhlSync(user.id)
  await awardOnce(user.id, 'verify_google', 'Cuenta de Google verificada')
  return { user, created: true }
}

/**
 * Foto de X a guardar como avatar, o null si no toca. Solo https de X, y nunca
 * pisa una foto subida por el usuario (/uploads/); sí reemplaza el emoji por
 * defecto y una foto de X anterior (así se refresca si la cambia en X).
 */
function xPhotoFor(current: string | null | undefined, photoUrl?: string): string | null {
  if (!photoUrl || !/^https:\/\/pbs\.twimg\.com\/\S+$/.test(photoUrl) || photoUrl.length > 500) return null
  if (current && current.startsWith('/uploads/')) return null
  return photoUrl
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
  reason: 'verify_x' | 'verify_google' | 'verify_discord',
  note: string
): Promise<number> {
  const prior = await db.pointEvent.findFirst({ where: { userId, reason } })
  if (prior) return 0
  // Discord y Telegram valen más que X o Google y son editables desde el panel
  // (points_verify_discord / points_verify_telegram); X y Google siguen con la
  // constante de siempre.
  const amount =
    reason === 'verify_discord' ? (await getPointRules()).points_verify_discord ?? 10 : VERIFY_BONUS
  return awardPoints(userId, reason, note, amount)
}
