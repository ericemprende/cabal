import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getViewer } from '@/lib/premium'

/** Quien ha dado señal en esta ventana cuenta como "en vivo". */
const ONLINE_WINDOW_MS = 3 * 60 * 1000
/** Como mucho una escritura por usuario y minuto (el navegador llama cada 60 s). */
const HEARTBEAT_EVERY_MS = 60 * 1000

/**
 * POST /api/online — latido de presencia. Todo usuario con sesión lo manda
 * cada minuto mientras tiene Cabal abierto y visible, y así cuenta como
 * conectado. Solo a Premium (y admins) se le devuelve cuántos hay en vivo:
 * es uno de los beneficios del plan. Los visitantes sin cuenta no cuentan.
 */
export async function POST(req: Request) {
  try {
    const viewer = await getViewer(req)
    if (!viewer.userId) return NextResponse.json({ premium: false, online: null })

    const now = Date.now()
    await db.user
      .updateMany({
        where: {
          id: viewer.userId,
          OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(now - HEARTBEAT_EVERY_MS + 5_000) } }],
        },
        data: { lastSeenAt: new Date(now) },
      })
      .catch(() => {})

    if (!viewer.premium) return NextResponse.json({ premium: false, online: null })
    const online = await db.user.count({ where: { lastSeenAt: { gte: new Date(now - ONLINE_WINDOW_MS) } } })
    return NextResponse.json({ premium: true, online: Math.max(1, online) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
