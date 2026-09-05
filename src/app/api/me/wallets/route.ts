import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/api-helpers'
import { isValidContract, isValidNetwork } from '@/lib/chain-stats'

function serialize(w: {
  id: string
  network: string
  address: string
  label: string
  signature: boolean
  createdAt: Date
}) {
  return {
    id: w.id,
    network: w.network,
    address: w.address,
    label: w.label,
    signature: w.signature,
    createdAt: w.createdAt.toISOString(),
  }
}

export async function GET() {
  try {
    const me = await getCurrentUser()
    const wallets = await db.walletLink.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(wallets.map(serialize))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    const body = (await req.json()) as { network?: string; address?: string; label?: string }
    const network = (body.network ?? '').trim()
    const address = (body.address ?? '').trim()
    if (!isValidNetwork(network)) {
      return NextResponse.json({ error: 'Red no soportada' }, { status: 400 })
    }
    if (!isValidContract(network, address) && network !== 'robinhood') {
      return NextResponse.json({ error: 'Dirección de wallet inválida para esta red' }, { status: 400 })
    }
    if (network === 'robinhood' && !/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(address)) {
      return NextResponse.json({ error: 'Dirección de wallet inválida' }, { status: 400 })
    }

    const wallet = await db.walletLink.upsert({
      where: {
        userId_network_address: { userId: me.id, network, address },
      },
      create: { userId: me.id, network, address, label: (body.label ?? '').slice(0, 24) },
      update: { label: (body.label ?? '').slice(0, 24) },
    })

    // Si el usuario no tenía wallet principal, esta pasa a serlo
    if (!me.wallet) {
      await db.user.update({
        where: { id: me.id },
        data: { wallet: address, walletVerified: true },
      })
    }

    return NextResponse.json(serialize(wallet))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await getCurrentUser()
    const id = new URL(req.url).searchParams.get('id') ?? ''
    const wallet = await db.walletLink.findUnique({ where: { id } })
    if (!wallet || wallet.userId !== me.id) {
      return NextResponse.json({ error: 'Wallet no encontrada' }, { status: 404 })
    }
    await db.walletLink.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
