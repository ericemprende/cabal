import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { hasPremium } from '@/lib/premium'
import { serializeVerifyRequest } from '@/lib/verification'

/** Mis solicitudes de verificación (perfil y launches). */
export async function GET() {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json([])
  const rows = await db.verificationRequest.findMany({
    where: { userId },
    include: { launch: { select: { id: true, name: true, ticker: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(rows.map(serializeVerifyRequest))
}

/**
 * Pedir la verificación del perfil o de un launch propio. Es un perk Premium:
 * el admin la revisa a mano antes de dar la insignia, para que pagar no baste
 * para verificar un clon.
 */
export async function POST(req: Request) {
  try {
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
    if (!(await hasPremium(userId))) {
      return NextResponse.json({ error: 'La verificación es parte del plan Premium' }, { status: 403 })
    }
    const body = (await req.json().catch(() => ({}))) as { kind?: string; launchId?: string; note?: string }
    const kind = body.kind === 'launch' ? 'launch' : body.kind === 'user' ? 'user' : null
    if (!kind) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''

    let launchId: string | null = null
    if (kind === 'launch') {
      const launch = typeof body.launchId === 'string' ? await db.launch.findUnique({ where: { id: body.launchId } }) : null
      if (!launch || launch.createdById !== userId) {
        return NextResponse.json({ error: 'Solo puedes verificar launches que publicaste tú' }, { status: 403 })
      }
      if (launch.verified) return NextResponse.json({ error: 'Este launch ya está verificado' }, { status: 400 })
      launchId = launch.id
    } else {
      const me = await db.user.findUnique({ where: { id: userId }, select: { verified: true } })
      if (me?.verified) return NextResponse.json({ error: 'Tu perfil ya está verificado' }, { status: 400 })
    }

    const open = await db.verificationRequest.findFirst({ where: { userId, kind, launchId, status: 'pending' } })
    if (open) return NextResponse.json({ error: 'Ya tienes una solicitud en revisión' }, { status: 400 })

    const row = await db.verificationRequest.create({
      data: { kind, userId, launchId, note },
      include: { launch: { select: { id: true, name: true, ticker: true } } },
    })
    return NextResponse.json(serializeVerifyRequest(row))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
