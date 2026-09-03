import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, getCurrentUser } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'

const VERIFY_BONUS = 5

/**
 * Verificación de identidad con proveedores externos.
 *
 * Flujo preparado para OAuth real (X API v2 / Google Identity Services):
 * en producción, `value` se reemplaza por el código/token que devuelve el
 * proveedor y aquí se intercambia por el perfil oficial. En este entorno de
 * demo simulamos la respuesta del proveedor a partir del handle/email.
 */
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    const body = await req.json()
    const provider = String(body.provider ?? '')
    const disconnect = Boolean(body.disconnect)
    const value = typeof body.value === 'string' ? body.value.trim() : ''

    if (disconnect) {
      const data =
        provider === 'x'
          ? { xHandle: null, xVerified: false }
          : provider === 'google'
            ? { googleEmail: null, googleVerified: false }
            : null
      if (!data) return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
      const updated = await db.user.update({ where: { id: me.id }, data })
      return NextResponse.json({ ok: true, user: toUserDTO(updated) })
    }

    if (provider === 'x') {
      const handle = value.replace(/^@+/, '')
      if (!/^[\w]{2,15}$/.test(handle)) {
        return NextResponse.json({ error: 'Handle de X inválido (2-15 caracteres)' }, { status: 400 })
      }
      const updated = await db.user.update({
        where: { id: me.id },
        data: { xHandle: handle, xVerified: true },
      })
      // Bonus una sola vez por proveedor
      const prior = await db.pointEvent.findFirst({ where: { userId: me.id, reason: 'verify_x' } })
      let pointsEarned = 0
      if (!prior) {
        pointsEarned = await awardPoints(me.id, 'verify_x', 'Cuenta de X verificada', VERIFY_BONUS)
      }
      return NextResponse.json({ ok: true, pointsEarned, user: toUserDTO(updated) })
    }

    if (provider === 'google') {
      const email = value.toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return NextResponse.json({ error: 'Email de Google inválido' }, { status: 400 })
      }
      const updated = await db.user.update({
        where: { id: me.id },
        data: { googleEmail: email, googleVerified: true },
      })
      const prior = await db.pointEvent.findFirst({ where: { userId: me.id, reason: 'verify_google' } })
      let pointsEarned = 0
      if (!prior) {
        pointsEarned = await awardPoints(me.id, 'verify_google', 'Cuenta de Google verificada', VERIFY_BONUS)
      }
      return NextResponse.json({ ok: true, pointsEarned, user: toUserDTO(updated) })
    }

    return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
