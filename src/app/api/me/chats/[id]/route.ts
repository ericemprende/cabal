import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { CHAT_PREFS, toChatLinkDTO } from '@/lib/chat-links'
import { isLang } from '@/lib/bot-i18n'
import { isReminderLead } from '@/lib/notify-types'

async function ownChat(id: string) {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return { error: NextResponse.json({ error: 'Inicia sesión' }, { status: 401 }) }
  const chat = await db.chatLink.findUnique({ where: { id } })
  if (!chat || chat.userId !== userId) {
    return { error: NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 }) }
  }
  return { chat }
}

/** PATCH /api/me/chats/:id — { notifyLaunches?, notifyReminders?, notifyTheses?, lang?, reminderLeadMin? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { chat, error } = await ownChat(id)
    if (!chat) return error
    const body = await req.json().catch(() => ({}))
    const data: Record<string, boolean | string | number> = {}
    for (const k of CHAT_PREFS) if (typeof body[k] === 'boolean') data[k] = body[k]
    if (isLang(body.lang)) data.lang = body.lang
    if (isReminderLead(body.reminderLeadMin)) data.reminderLeadMin = body.reminderLeadMin
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 })
    const updated = await db.chatLink.update({ where: { id: chat.id }, data })
    return NextResponse.json(toChatLinkDTO(updated))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** DELETE /api/me/chats/:id — desvincula el chat (el bot deja de escribir ahí). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { chat, error } = await ownChat(id)
    if (!chat) return error
    await db.chatLink.delete({ where: { id: chat.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
