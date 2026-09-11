import { NextResponse } from 'next/server'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { emailConfig, sendEmail } from '@/lib/email'
import { isValidEmail } from '@/lib/email-codes'

/** POST /api/admin/integrations/test-email — { to } comprueba que el proveedor de correo funciona. */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const to = String(body.to ?? '').trim().toLowerCase()
    if (!isValidEmail(to)) return NextResponse.json({ error: 'Correo no válido' }, { status: 400 })
    const cfg = emailConfig()
    await sendEmail({
      to,
      subject: 'Prueba de correo · Cabal',
      text: `Si lees esto, el envío de correos de Cabal funciona (${cfg?.provider ?? 'consola de desarrollo'}).`,
      html: `<p style="font-family:Arial,sans-serif">Si lees esto, el envío de correos de Cabal funciona (<b>${cfg?.provider ?? 'consola de desarrollo'}</b>).</p>`,
    })
    return NextResponse.json({ ok: true, provider: cfg?.provider ?? null })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
