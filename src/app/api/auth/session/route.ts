import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { toUserDTO } from '@/lib/serializers'
import { sessionUserIdFromCookies } from '@/lib/auth'

// GET /api/auth/session — ¿hay una cuenta logueada en esta sesión?
export async function GET() {
  try {
    await ensureSeeded()
    const userId = await sessionUserIdFromCookies()
    if (!userId) return NextResponse.json({ loggedIn: false })
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ loggedIn: false })
    return NextResponse.json({ loggedIn: true, user: toUserDTO(user) })
  } catch {
    return NextResponse.json({ loggedIn: false })
  }
}
