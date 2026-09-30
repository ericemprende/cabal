import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { awardPoints, requireSessionUser, errorStatus } from '@/lib/api-helpers'
import { verifyWalletSignature, walletMessage } from '@/lib/wallet-verify'

const VERIFY_WALLET_BONUS = 10

/** Verifica por firma la posesión de una wallet conectada (Solana ed25519 / EVM personal_sign). */
export async function POST(req: Request) {
  try {
    const me = await requireSessionUser()
    const body = (await req.json()) as {
      id?: string
      message?: string
      signature?: string
    }
    const id = body.id ?? ''
    const wallet = await db.walletLink.findUnique({ where: { id } })
    if (!wallet || wallet.userId !== me.id) {
      return NextResponse.json({ error: 'Wallet no encontrada' }, { status: 404 })
    }
    const message = body.message ?? ''
    const signature = (body.signature ?? '').trim()
    const expected = walletMessage(wallet.address)
    if (message !== expected) {
      return NextResponse.json({ error: 'El mensaje firmado no coincide' }, { status: 400 })
    }
    const ok = verifyWalletSignature(wallet.network, wallet.address, message, signature)
    if (!ok) {
      return NextResponse.json(
        { error: 'La firma no es válida para esta dirección' },
        { status: 400 }
      )
    }

    await db.walletLink.update({ where: { id }, data: { signature: true } })
    await db.user.update({
      where: { id: me.id },
      data: { wallet: wallet.address, walletVerified: true },
    })

    // Bonus una sola vez por usuario
    const prior = await db.pointEvent.findFirst({
      where: { userId: me.id, reason: 'verify_wallet' },
    })
    let pointsEarned = 0
    if (!prior) {
      pointsEarned = await awardPoints(me.id, 'verify_wallet', 'Wallet verificada con firma', VERIFY_WALLET_BONUS)
    }

    return NextResponse.json({ ok: true, pointsEarned })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: errorStatus(e) })
  }
}
