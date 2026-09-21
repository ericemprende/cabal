import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { chatAnnounceConfig, postChatAnnouncement, saveChatAnnounceConfig } from '@/lib/chat-announce'

function fail(e: unknown) {
  if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
  return NextResponse.json({ error: (e as Error).message }, { status: 500 })
}

/** GET /api/admin/chat-announce — el aviso automático del chat en vivo. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    return NextResponse.json(await chatAnnounceConfig())
  } catch (e) {
    return fail(e)
  }
}

/** PUT — guarda texto, cada cuántas horas y el botón. */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json()
    return NextResponse.json(await saveChatAnnounceConfig(body ?? {}))
  } catch (e) {
    return fail(e)
  }
}

/** POST { action: 'send' } — publica el aviso ya y reinicia la cuenta atrás. */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    if (body?.action !== 'send') return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
    const message = await postChatAnnouncement({ force: true })
    if (!message) return NextResponse.json({ error: 'El mensaje del aviso está vacío' }, { status: 400 })
    return NextResponse.json({ ok: true, config: await chatAnnounceConfig(), message })
  } catch (e) {
    return fail(e)
  }
}
