import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { reminderChannels } from '@/lib/reminders'

/**
 * POST /api/launches/:id/remind — activa o quita la campanita del launch.
 * Devuelve el estado nuevo y por dónde llegaría el aviso, para que la web
 * sugiera conectar Telegram si no hay ningún canal.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión para activar el aviso' }, { status: 401 })
    const limit = await rateLimit(`remind:${userId}`, 40, 60)
    if (!limit.ok) return tooManyRequests(limit)

    const { id } = await params
    const launch = await db.launch.findUnique({ where: { id }, select: { hidden: true, launchAt: true } })
    if (!launch || launch.hidden) return NextResponse.json({ error: 'Launch no encontrado' }, { status: 404 })

    const existing = await db.launchReminder.findUnique({ where: { userId_launchId: { userId, launchId: id } } })
    if (existing) {
      await db.launchReminder.delete({ where: { id: existing.id } })
    } else {
      if (launch.launchAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Este launch ya salió' }, { status: 400 })
      }
      await db.launchReminder.create({ data: { userId, launchId: id } })
    }
    return NextResponse.json({ ok: true, reminded: !existing, channels: await reminderChannels(userId) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
