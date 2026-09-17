import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { REMINDER_LEAD_MIN } from '@/lib/notifications'
import { reminderChannels } from '@/lib/reminders'
import type { MyRemindersDTO } from '@/lib/notify-types'

/** GET /api/me/reminders — launches con la campanita activa y canales de aviso. */
export async function GET() {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) {
      const empty: MyRemindersDTO = {
        launchIds: [],
        channels: { telegram: false, email: false },
        leadMinutes: REMINDER_LEAD_MIN,
      }
      return NextResponse.json(empty)
    }
    const [rows, channels] = await Promise.all([
      db.launchReminder.findMany({ where: { userId }, select: { launchId: true } }),
      reminderChannels(userId),
    ])
    const dto: MyRemindersDTO = { launchIds: rows.map((r) => r.launchId), channels, leadMinutes: REMINDER_LEAD_MIN }
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
