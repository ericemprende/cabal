import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { reminderChannels } from '@/lib/reminders'
import { DEFAULT_REMINDER_LEAD, isReminderLead, type MyRemindersDTO } from '@/lib/notify-types'

/** GET /api/me/reminders — launches con la campanita activa y canales de aviso. */
export async function GET() {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) {
      const empty: MyRemindersDTO = {
        launchIds: [],
        channels: { telegram: false, discord: false, email: false },
        leadMinutes: DEFAULT_REMINDER_LEAD,
      }
      return NextResponse.json(empty)
    }
    const [rows, channels, user] = await Promise.all([
      db.launchReminder.findMany({ where: { userId }, select: { launchId: true } }),
      reminderChannels(userId),
      db.user.findUnique({ where: { id: userId }, select: { reminderLeadMin: true } }),
    ])
    const dto: MyRemindersDTO = {
      launchIds: rows.map((r) => r.launchId),
      channels,
      leadMinutes: user?.reminderLeadMin ?? DEFAULT_REMINDER_LEAD,
    }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * PATCH /api/me/reminders — { leadMinutes }
 * Con cuánta antelación quiere el usuario el aviso de su campanita. Manda
 * también sobre lo que llega a su chat privado con los bots.
 */
export async function PATCH(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    if (!isReminderLead(body.leadMinutes)) {
      return NextResponse.json({ error: 'Antelación no válida' }, { status: 400 })
    }
    await db.user.update({ where: { id: userId }, data: { reminderLeadMin: body.leadMinutes } })
    return NextResponse.json({ ok: true, leadMinutes: body.leadMinutes })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
