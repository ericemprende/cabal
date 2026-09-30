import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { emailConfig } from '@/lib/email'
import { isValidEmail } from '@/lib/email-codes'
import {
  broadcastStats,
  loadDraft,
  saveDraft,
  sendBroadcastBatch,
  sendBroadcastTest,
  type BroadcastDraft,
} from '@/lib/email-broadcast'

/** Tanda máxima por pulsación: la petición tarda ~0,6 s por correo. */
const MAX_BATCH = 500

function fail(e: unknown) {
  if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
  return NextResponse.json({ error: (e as Error).message }, { status: 500 })
}

function parseDraft(body: Record<string, unknown>): BroadcastDraft | string {
  const d = {
    key: String(body.key ?? '').trim().toLowerCase(),
    subject: String(body.subject ?? '').trim(),
    body: String(body.body ?? '').trim(),
    ctaLabel: String(body.ctaLabel ?? '').trim(),
    ctaUrl: String(body.ctaUrl ?? '').trim(),
  }
  if (!/^[a-z0-9-]{3,40}$/.test(d.key)) return 'El identificador solo admite minúsculas, números y guiones (3-40)'
  if (!d.subject || d.subject.length > 150) return 'Escribe un asunto (máximo 150 caracteres)'
  if (!d.body || d.body.length > 5000) return 'Escribe el mensaje (máximo 5000 caracteres)'
  if (!d.ctaLabel || d.ctaLabel.length > 40) return 'Escribe el texto del botón (máximo 40 caracteres)'
  if (!/^https:\/\/\S+$/.test(d.ctaUrl)) return 'El enlace del botón tiene que empezar por https://'
  return d
}

/** GET /api/admin/email/broadcast — borrador guardado, destinatarios y proveedor. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const draft = await loadDraft()
    const mail = emailConfig()
    return NextResponse.json({
      draft,
      stats: await broadcastStats(draft.key),
      provider: mail?.provider ?? null,
      from: mail?.from.email ?? null,
    })
  } catch (e) {
    return fail(e)
  }
}

/**
 * POST /api/admin/email/broadcast
 *  - { ...borrador, action: 'save' }             guarda el borrador
 *  - { ...borrador, action: 'test', to }          lo manda solo a ese correo
 *  - { ...borrador, action: 'send', limit }       manda la siguiente tanda
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const draft = parseDraft(body)
    if (typeof draft === 'string') return NextResponse.json({ error: draft }, { status: 400 })
    await saveDraft(draft)

    if (body.action === 'test') {
      const to = String(body.to ?? '').trim().toLowerCase()
      if (!isValidEmail(to)) return NextResponse.json({ error: 'Correo de prueba no válido' }, { status: 400 })
      await sendBroadcastTest(draft, to)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'send') {
      if (!emailConfig()) {
        return NextResponse.json({ error: 'Configura RESEND_API_KEY y EMAIL_FROM antes de enviar' }, { status: 400 })
      }
      const limit = Math.max(1, Math.min(MAX_BATCH, Math.floor(Number(body.limit) || 90)))
      const result = await sendBroadcastBatch(draft, limit)
      return NextResponse.json({ ok: true, ...result, stats: await broadcastStats(draft.key) })
    }

    return NextResponse.json({ ok: true, stats: await broadcastStats(draft.key) })
  } catch (e) {
    return fail(e)
  }
}
