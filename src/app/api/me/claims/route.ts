import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/api-helpers'
import { fetchTokenStats, isValidContract, isValidNetwork } from '@/lib/chain-stats'
import { serializeDevClaim as serialize } from '@/lib/claims'

export async function GET() {
  try {
    const me = await getCurrentUser()
    const claims = await db.devClaim.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(claims.map(serialize))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * Verificar un token antiguo como dev: el usuario reclama un CA, el backend
 * consulta DexScreener/GeckoTerminal y guarda las métricas reales (MC, ATH,
 * liquidez, volumen, edad, concentración). Si no hay par activo queda
 * "pending" para reintentar.
 */
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    const body = (await req.json()) as {
      network?: string
      contract?: string
      walletAddress?: string
    }
    const network = (body.network ?? '').trim()
    const contract = (body.contract ?? '').trim()
    const walletAddress = (body.walletAddress ?? '').trim()

    if (!isValidNetwork(network)) {
      return NextResponse.json({ error: 'Red no soportada' }, { status: 400 })
    }
    if (!isValidContract(network, contract)) {
      return NextResponse.json({ error: 'CA/contrato inválido para esta red' }, { status: 400 })
    }
    if (!walletAddress) {
      return NextResponse.json({ error: 'Indica la wallet del dev' }, { status: 400 })
    }

    const stats = await fetchTokenStats(network, contract)

    const data = {
      walletAddress,
      name: stats.name,
      symbol: stats.symbol,
      status: stats.found ? 'verified' : 'pending',
      note: stats.found
        ? ''
        : 'No encontramos un par activo para ese CA. Se reintentará al actualizar.',
      stats: JSON.stringify(stats),
      source: stats.found ? `dexscreener${stats.dexId ? `/${stats.dexId}` : ''}` : 'dexscreener',
      verifiedAt: stats.found ? new Date() : null,
    }

    const claim = await db.devClaim.upsert({
      where: {
        userId_network_contract: { userId: me.id, network, contract },
      },
      create: { userId: me.id, network, contract, ...data },
      update: data,
    })

    if (stats.found && !me.isDev) {
      await db.user.update({ where: { id: me.id }, data: { isDev: true } })
    }

    return NextResponse.json({
      ok: true,
      verified: stats.found,
      claim: serialize(claim),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await getCurrentUser()
    const id = new URL(req.url).searchParams.get('id') ?? ''
    const claim = await db.devClaim.findUnique({ where: { id } })
    if (!claim || claim.userId !== me.id) {
      return NextResponse.json({ error: 'Reclamo no encontrado' }, { status: 404 })
    }
    await db.devClaim.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
