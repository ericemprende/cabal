import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toPublicUserDTO } from '@/lib/serializers'

/**
 * GET /api/users/search?q=... — buscar personas por nombre o por @usuario.
 *
 * Alimenta el buscador general de la cabecera. Es pública, como el propio
 * perfil (/u/<handle>), y devuelve solo la versión pública del usuario.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').replace(/^@+/, '').trim().slice(0, 40)
  // Con una sola letra la lista es ruido: se pide desde dos
  if (q.length < 2) return NextResponse.json([])

  try {
    const users = await db.user.findMany({
      where: {
        OR: [
          { handle: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      // Primero los verificados y los que más puntos tienen: quien busca
      // "eric" quiere al Eric conocido, no a la cuenta recién creada.
      orderBy: [{ verified: 'desc' }, { points: 'desc' }],
      take: 8,
    })
    return NextResponse.json(users.map((u) => toPublicUserDTO(u)))
  } catch {
    return NextResponse.json([])
  }
}
