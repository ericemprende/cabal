import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { PUSH_KINDS, pushPublicKey, sendPush, type PushKind } from '@/lib/push'
import type { MyPushDTO, PushDeviceDTO } from '@/lib/notify-types'

/**
 * Avisos push del navegador. Cada dispositivo (endpoint que da el navegador)
 * es una fila con sus preferencias, así que todo se identifica por `endpoint`.
 *
 *   GET    → clave pública + mis dispositivos
 *   POST   → alta o actualización de este dispositivo { endpoint, keys, prefs?, label? }
 *   PATCH  → cambiar preferencias { endpoint, prefs }
 *   DELETE → dar de baja este dispositivo { endpoint }
 */

const FIELD: Record<PushKind, keyof PushDeviceDTO['prefs']> = {
  launches: 'launches',
  reminders: 'reminders',
  calls: 'calls',
  theses: 'theses',
  replies: 'replies',
}

type Row = {
  id: string
  endpoint: string
  label: string | null
  notifyLaunches: boolean
  notifyReminders: boolean
  notifyCalls: boolean
  notifyTheses: boolean
  notifyReplies: boolean
  createdAt: Date
}

function toDevice(row: Row): PushDeviceDTO {
  return {
    id: row.id,
    endpoint: row.endpoint,
    label: row.label,
    prefs: {
      launches: row.notifyLaunches,
      reminders: row.notifyReminders,
      calls: row.notifyCalls,
      theses: row.notifyTheses,
      replies: row.notifyReplies,
    },
    createdAt: row.createdAt.toISOString(),
  }
}

/** Preferencias del cuerpo de la petición a columnas, ignorando lo que no toca. */
function prefsToData(prefs: unknown): Record<string, boolean> {
  const data: Record<string, boolean> = {}
  if (!prefs || typeof prefs !== 'object') return data
  const input = prefs as Record<string, unknown>
  for (const kind of PUSH_KINDS) {
    const value = input[FIELD[kind]]
    if (typeof value === 'boolean') {
      data[`notify${kind[0].toUpperCase()}${kind.slice(1)}`] = value
    }
  }
  return data
}

export async function GET() {
  try {
    const publicKey = pushPublicKey()
    const userId = await sessionUserIdFromCookies()
    if (!userId) {
      const dto: MyPushDTO = { configured: !!publicKey, publicKey, devices: [] }
      return NextResponse.json(dto)
    }
    const rows = await db.pushSubscription.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'asc' },
    })
    const dto: MyPushDTO = { configured: !!publicKey, publicKey, devices: rows.map(toDevice) }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    if (!pushPublicKey()) {
      return NextResponse.json({ error: 'Los avisos push no están configurados en el servidor' }, { status: 503 })
    }
    const body = await req.json().catch(() => ({}))
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
    const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
    const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''
    if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
    }
    const label = typeof body.label === 'string' ? body.label.slice(0, 60) : null
    const prefs = prefsToData(body.prefs)

    // El mismo endpoint puede venir de otra cuenta (dispositivo compartido):
    // se lo queda quien lo registra ahora.
    const row = await db.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh, auth, label, ...prefs },
      update: { userId, p256dh, auth, active: true, lastError: null, ...(label ? { label } : {}), ...prefs },
    })
    return NextResponse.json({ ok: true, device: toDevice(row) }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
    const existing = await db.pushSubscription.findUnique({ where: { endpoint } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Este dispositivo no está registrado' }, { status: 404 })
    }
    const data = prefsToData(body.prefs)
    const row = await db.pushSubscription.update({ where: { endpoint }, data })

    // Un aviso de prueba al encender algo, para que se vea que funciona
    if (body.test === true) {
      await sendPush([row], {
        title: 'Avisos activados',
        body: 'Así se verán los avisos de Cabal en este dispositivo.',
        url: '/app',
        tag: 'cabal-test',
      })
    }
    return NextResponse.json({ ok: true, device: toDevice(row) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
    await db.pushSubscription.deleteMany({ where: { endpoint, userId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
