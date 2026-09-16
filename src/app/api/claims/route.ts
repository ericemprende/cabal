import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/api-helpers'
import { verifyProjectOwnership } from '@/lib/chain-verify'

const NETWORKS = ['solana', 'base', 'ethereum', 'bsc', 'tron', 'robinhood', 'arc']

function normalizeContract(ca: string): string {
  return ca.trim()
}

// GET /api/claims — mis reclamos (con nombre del proyecto)
export async function GET() {
  try {
    const me = await getCurrentUser()
    const claims = await db.projectClaim.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
    })
    const launchIds = claims.filter((c) => c.targetType === 'launch').map((c) => c.targetId)
    const tokenIds = claims.filter((c) => c.targetType === 'token').map((c) => c.targetId)
    const [launches, tokens] = await Promise.all([
      launchIds.length ? db.launch.findMany({ where: { id: { in: launchIds } } }) : [],
      tokenIds.length ? db.token.findMany({ where: { id: { in: tokenIds } } }) : [],
    ])
    const withNames = claims.map((c) => {
      const proj =
        c.targetType === 'launch'
          ? launches.find((l) => l.id === c.targetId)
          : tokens.find((t) => t.id === c.targetId)
      return {
        ...c,
        projectName: proj?.name ?? 'Proyecto',
        projectTicker: (proj as { ticker?: string | null } | undefined)?.ticker ?? null,
      }
    })
    return NextResponse.json({ claims: withNames })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/claims — reclamar la propiedad de un proyecto por su CA
// Body: { contract, network, wallet }
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    const body = await req.json()
    const contract = normalizeContract(String(body.contract ?? ''))
    const network = String(body.network ?? '').trim()
    const wallet = String(body.wallet ?? '').trim()

    if (!contract || contract.length < 8) {
      return NextResponse.json({ error: 'Pega el contrato (CA) del token' }, { status: 400 })
    }
    if (!NETWORKS.includes(network)) {
      return NextResponse.json({ error: 'Red no soportada' }, { status: 400 })
    }
    if (!wallet) {
      return NextResponse.json(
        { error: 'Conecta tu wallet o pega tu dirección para verificar' },
        { status: 400 }
      )
    }

    // Busca el proyecto en la plataforma por CA + red
    const token = await db.token.findFirst({ where: { contract, network } })
    const launch = token ? null : await db.launch.findFirst({ where: { contract, network } })
    if (!token && !launch) {
      return NextResponse.json(
        { error: 'No encontramos un proyecto con ese CA en Cabal. Verifica la red.' },
        { status: 404 }
      )
    }
    const targetType: 'launch' | 'token' = token ? 'token' : 'launch'
    const targetId = (token ?? launch)!.id

    // ¿Ya verificado por otra persona?
    const taken = await db.projectClaim.findFirst({
      where: { targetType, targetId, status: 'verified', userId: { not: me.id } },
    })
    if (taken) {
      return NextResponse.json(
        { error: 'Ese proyecto ya está reclamado por otro dev verificado' },
        { status: 409 }
      )
    }

    // Verificación on-chain (Solana: mint authority o creador)
    const check = await verifyProjectOwnership(network, contract, wallet)

    const claim = await db.projectClaim.upsert({
      where: { userId_targetType_targetId: { userId: me.id, targetType, targetId } },
      create: {
        userId: me.id,
        targetType,
        targetId,
        network,
        contract,
        wallet,
        status: check.verified ? 'verified' : 'pending',
        method: check.method,
        note: check.note,
        verifiedAt: check.verified ? new Date() : null,
      },
      update: {
        wallet,
        status: check.verified ? 'verified' : 'pending',
        method: check.method,
        note: check.note,
        verifiedAt: check.verified ? new Date() : null,
      },
    })

    // Si quedó verificado y es un token, vínculalo como su dev
    if (check.verified && token) {
      await db.token.update({ where: { id: token.id }, data: { devId: me.id } })
    }

    return NextResponse.json({
      ok: true,
      claim: { ...claim, projectName: (token ?? launch)!.name },
      verified: check.verified,
      note: check.note,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
