import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorStatus, requireSessionUser } from '@/lib/api-helpers'
import { SESSION_COOKIE, clearSessionCookieOptions } from '@/lib/auth'
import { invalidate } from '@/lib/cache'

/**
 * DELETE /api/me/account — { confirm: "<tu handle>" }
 *
 * Borra la cuenta de quien la pide (lo exigen App Store y Google Play: tiene
 * que poder hacerse desde la propia app). No se borran filas: los pagos deben
 * conservarse por contabilidad y los posts y launches forman parte de hilos de
 * otras personas. Lo que se hace es quitar todo dato personal, cortar los
 * vínculos (wallets, redes, bots, push, seguidores) y marcar deletedAt, con lo
 * que la sesión deja de valer (ver sessionUserIdFromCookies).
 */
export async function DELETE(req: Request) {
  try {
    const me = await requireSessionUser()
    const body = await req.json().catch(() => ({}))
    const confirm = String(body.confirm ?? '').trim().replace(/^@/, '').toLowerCase()
    if (confirm !== me.handle.toLowerCase()) {
      return NextResponse.json({ error: 'Escribe tu @usuario para confirmar' }, { status: 400 })
    }
    if (me.isAdmin) {
      return NextResponse.json({ error: 'Una cuenta de admin no se borra desde aquí' }, { status: 403 })
    }

    const tag = me.id.slice(-8)
    await db.$transaction([
      db.walletLink.deleteMany({ where: { userId: me.id } }),
      db.pushSubscription.deleteMany({ where: { userId: me.id } }),
      db.chatLink.deleteMany({ where: { userId: me.id } }),
      db.chatLinkCode.deleteMany({ where: { userId: me.id } }),
      db.emailCode.deleteMany({ where: { userId: me.id } }),
      db.launchReminder.deleteMany({ where: { userId: me.id } }),
      db.follow.deleteMany({ where: { OR: [{ userId: me.id }, { targetId: me.id }] } }),
      db.user.update({
        where: { id: me.id },
        data: {
          handle: `deleted-${tag}`,
          name: 'Cuenta eliminada',
          avatar: '🐺',
          bio: null,
          wallet: null,
          walletVerified: false,
          passwordHash: null,
          email: null,
          emailVerified: false,
          twoFactorEnabled: false,
          xHandle: null,
          xVerified: false,
          googleEmail: null,
          googleVerified: false,
          discordId: null,
          discordName: null,
          discordVerified: false,
          tgHandle: null,
          referralCode: null,
          followers: 0,
          notifyEmail: false,
          showTrackRecord: false,
          ghlContactId: null,
          deletedAt: new Date(),
        },
      }),
    ])
    await invalidate('leaderboard:*')

    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, '', clearSessionCookieOptions())
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: errorStatus(e) })
  }
}
