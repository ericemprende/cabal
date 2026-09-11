import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { codeEmail, maskEmail, sendEmail, type CodePurpose } from '@/lib/email'

/**
 * Códigos de seguridad de 6 dígitos enviados por correo: verificar el correo,
 * completar un inicio de sesión con 2FA y activar/desactivar el 2FA.
 *
 * Los límites viven en la base de datos y no en Redis a propósito: sin
 * REDIS_URL el rate limiting de la app se desactiva, y aquí eso abriría la
 * puerta a probar el millón de códigos.
 */

export type { CodePurpose }

const TTL_MS = 10 * 60_000
const MAX_ATTEMPTS = 5
/** Espera mínima entre dos envíos del mismo tipo. */
const COOLDOWN_MS = 45_000
const MAX_PER_HOUR = 8

export class CodeRateLimitError extends Error {}

function secret(): string {
  return process.env.AUTH_SECRET || 'cabal-user-secret-v1'
}

function hashCode(userId: string, purpose: CodePurpose, code: string): string {
  return createHmac('sha256', secret()).update(`${userId}:${purpose}:${code}`).digest('hex')
}

/**
 * Genera un código, lo guarda (solo el hash) y lo envía. Invalida los códigos
 * anteriores del mismo tipo: solo vale el último que se pidió.
 * Devuelve el id (identifica el reto del login) y el correo enmascarado.
 */
export async function sendCode(
  userId: string,
  purpose: CodePurpose,
  email: string
): Promise<{ id: string; emailHint: string }> {
  const recent = await db.emailCode.findMany({
    where: { userId, purpose, createdAt: { gt: new Date(Date.now() - 3600_000) } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < COOLDOWN_MS) {
    throw new CodeRateLimitError('Espera unos segundos antes de pedir otro código')
  }
  if (recent.length >= MAX_PER_HOUR) {
    throw new CodeRateLimitError('Has pedido demasiados códigos. Prueba de nuevo dentro de un rato.')
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await db.emailCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } })
  const row = await db.emailCode.create({
    data: {
      userId,
      purpose,
      email,
      codeHash: hashCode(userId, purpose, code),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  })

  try {
    await sendEmail({ to: email, ...codeEmail(code, purpose) })
  } catch (e) {
    // Si no salió, que no cuente para la espera ni para el tope por hora
    await db.emailCode.delete({ where: { id: row.id } }).catch(() => {})
    throw e
  }
  return { id: row.id, emailHint: maskEmail(email) }
}

export type CheckResult = { ok: true; email: string } | { ok: false; error: string }

/**
 * Comprueba el último código vivo del tipo pedido (o uno concreto, si se pasa
 * su id) y lo consume. Cada fallo cuenta; al quinto hay que pedir otro.
 */
export async function checkCode(
  userId: string,
  purpose: CodePurpose,
  code: string,
  id?: string
): Promise<CheckResult> {
  const row = await db.emailCode.findFirst({
    where: { userId, purpose, consumedAt: null, ...(id ? { id } : {}) },
    orderBy: { createdAt: 'desc' },
  })
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'El código caducó. Pide uno nuevo.' }
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'Demasiados intentos. Pide un código nuevo.' }
  }

  const clean = code.replace(/\D/g, '')
  const expected = Buffer.from(row.codeHash)
  const given = Buffer.from(hashCode(userId, purpose, clean))
  const match = clean.length === 6 && expected.length === given.length && timingSafeEqual(expected, given)
  if (!match) {
    await db.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } })
    const left = MAX_ATTEMPTS - row.attempts - 1
    return {
      ok: false,
      error: left > 0 ? `Código incorrecto. Te quedan ${left} intento${left === 1 ? '' : 's'}.` : 'Código incorrecto. Pide uno nuevo.',
    }
  }

  // Consumo atómico: si llegan dos peticiones con el mismo código, solo una gana
  const consumed = await db.emailCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  if (consumed.count === 0) return { ok: false, error: 'Ese código ya se usó. Pide uno nuevo.' }
  return { ok: true, email: row.email }
}

/** El reto de login (id del código) pertenece a esta cuenta y sigue vivo. */
export async function loginChallengeUser(challengeId: string): Promise<string | null> {
  const row = await db.emailCode.findUnique({
    where: { id: challengeId },
    select: { userId: true, purpose: true, consumedAt: true, expiresAt: true },
  })
  if (!row || row.purpose !== 'login' || row.consumedAt || row.expiresAt.getTime() < Date.now()) return null
  return row.userId
}

/**
 * Último reto de login aún válido. Si alguien reintenta el login a los pocos
 * segundos, se le devuelve el mismo reto en vez de hacerle esperar para otro
 * correo: el código que ya le llegó sigue sirviendo.
 */
export async function liveLoginChallenge(userId: string): Promise<{ id: string; emailHint: string } | null> {
  const row = await db.emailCode.findFirst({
    where: { userId, purpose: 'login', consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true },
  })
  return row ? { id: row.id, emailHint: maskEmail(row.email) } : null
}

/**
 * Adopta un correo que ya verificó un proveedor (el OAuth real de Google) si la
 * cuenta aún no tiene uno verificado. Devuelve si lo adoptó.
 */
export async function adoptVerifiedEmail(userId: string, rawEmail: string): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase()
  if (!isValidEmail(email)) return false
  const user = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true } })
  if (!user || user.emailVerified) return false
  if (await emailTakenByOther(email, userId)) return false
  await db.user.update({ where: { id: userId }, data: { email, emailVerified: true } })
  return true
}

// ---------- Política del sitio ----------
const TWO_FACTOR_REQUIRED_KEY = 'security_2fa_required'

/**
 * El admin puede exigir el código por correo a todas las cuentas con correo
 * verificado, lo tengan activado o no. Ojo con el volumen: es un correo por
 * cada inicio de sesión con contraseña.
 */
export async function twoFactorRequired(): Promise<boolean> {
  const s = await db.setting.findUnique({ where: { key: TWO_FACTOR_REQUIRED_KEY } })
  return s?.value === 'true'
}

export async function setTwoFactorRequired(value: boolean): Promise<void> {
  await db.setting.upsert({
    where: { key: TWO_FACTOR_REQUIRED_KEY },
    update: { value: String(value) },
    create: { key: TWO_FACTOR_REQUIRED_KEY, value: String(value) },
  })
}

/** Un correo con este formato puede recibir mensajes (comprobación básica). */
export function isValidEmail(v: string): boolean {
  return v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

/** ¿Otra cuenta tiene ya este correo verificado? */
export async function emailTakenByOther(email: string, userId?: string): Promise<boolean> {
  const other = await db.user.findFirst({
    where: { email, emailVerified: true, ...(userId ? { id: { not: userId } } : {}) },
    select: { id: true },
  })
  return Boolean(other)
}
