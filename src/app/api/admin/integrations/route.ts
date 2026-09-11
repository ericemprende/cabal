import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { ghlConfig } from '@/lib/ghl'
import { emailConfig } from '@/lib/email'
import { setTwoFactorRequired, twoFactorRequired } from '@/lib/email-codes'
import type { AdminIntegrationsDTO } from '@/lib/types'

/** GET /api/admin/integrations — estado de GHL, del correo y de la seguridad. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const ghl = ghlConfig()
    const mail = emailConfig()
    const [synced, pending, failed, lastFailed, required, twoFactorUsers, verifiedEmails, withoutEmail] =
      await Promise.all([
        db.user.count({ where: { ghlSyncedAt: { not: null } } }),
        db.user.count({ where: { email: { not: null }, ghlSyncedAt: null } }),
        db.user.count({ where: { ghlSyncedAt: null, ghlError: { not: null } } }),
        db.user.findFirst({
          where: { ghlSyncedAt: null, ghlError: { not: null } },
          orderBy: { createdAt: 'desc' },
          select: { ghlError: true },
        }),
        twoFactorRequired(),
        db.user.count({ where: { twoFactorEnabled: true } }),
        db.user.count({ where: { emailVerified: true } }),
        db.user.count({ where: { email: null, isCurrentUser: false } }),
      ])

    const dto: AdminIntegrationsDTO = {
      ghl: {
        configured: Boolean(ghl),
        tag: ghl?.tag ?? 'Cabal',
        workflow: Boolean(ghl?.workflowId),
        synced,
        pending,
        failed,
        lastError: lastFailed?.ghlError ?? null,
      },
      email: { configured: Boolean(mail), provider: mail?.provider ?? null, from: mail?.from.email ?? null },
      security: { twoFactorRequired: required, twoFactorUsers, verifiedEmails, withoutEmail },
    }
    return NextResponse.json(dto)
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** PUT /api/admin/integrations — { twoFactorRequired: boolean } */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    if (typeof body.twoFactorRequired !== 'boolean') {
      return NextResponse.json({ error: 'Falta twoFactorRequired' }, { status: 400 })
    }
    await setTwoFactorRequired(body.twoFactorRequired)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
