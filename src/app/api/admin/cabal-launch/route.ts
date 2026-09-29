import { NextResponse } from 'next/server'
import { VersionedTransaction } from '@solana/web3.js'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import {
  CABAL_CONFIG_KEY,
  CABAL_LAUNCH_TERMS,
  buildCabalConfigTx,
  buildPartnerClaimTx,
  cabalConfigId,
  cabalPendingFees,
} from '@/lib/cabal-launch'
import { launchFeeSettings, sendAndConfirm } from '@/lib/pump-launch'

export const runtime = 'nodejs'

function fail(e: unknown) {
  if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
  console.error('[admin/cabal-launch]', e)
  return NextResponse.json({ error: (e as Error).message }, { status: 500 })
}

/**
 * GET /api/admin/cabal-launch — estado de Cabal Launch: su configuración, las
 * condiciones y lo que Cabal tiene por reclamar en cada token lanzado.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const [config, { wallet }] = await Promise.all([cabalConfigId(), launchFeeSettings()])
    const coins = config
      ? await db.pumpCoin.findMany({
          where: { platform: 'cabal', status: 'launched' },
          orderBy: { launchedAt: 'desc' },
          take: 50,
        })
      : []
    const tokens = await Promise.all(
      coins.map(async (c) => ({
        mint: c.mint,
        name: c.name,
        symbol: c.symbol,
        image: c.image,
        partnerSol: (await cabalPendingFees(c.mint))?.partnerSol ?? 0,
      })),
    )
    return NextResponse.json({ config: config?.toBase58() ?? null, feeClaimer: wallet, terms: CABAL_LAUNCH_TERMS, tokens })
  } catch (e) {
    return fail(e)
  }
}

/**
 * POST /api/admin/cabal-launch
 * - `prepare`: { payer, config } → transacción que crea la configuración (una
 *   sola vez). La firman la wallet del admin y la clave `config` del navegador.
 * - `save`: { config, tx } → la manda firmada y guarda la configuración.
 * - `claim`: { mint } → transacción para reclamar la parte de Cabal de ese
 *   token; la firma la wallet que cobra (la de /admin → Comisiones).
 */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, string>

    if (body.step === 'prepare') {
      if (await cabalConfigId()) return NextResponse.json({ error: 'Cabal Launch ya está configurado' }, { status: 409 })
      const { wallet } = await launchFeeSettings()
      const tx = await buildCabalConfigTx({ payer: body.payer, config: body.config, feeClaimer: wallet })
      return NextResponse.json({ ok: true, tx })
    }

    if (body.step === 'save') {
      if (await cabalConfigId()) return NextResponse.json({ error: 'Cabal Launch ya está configurado' }, { status: 409 })
      const tx = VersionedTransaction.deserialize(Buffer.from(body.tx, 'base64'))
      if (!tx.message.staticAccountKeys.some((k) => k.toBase58() === body.config)) {
        return NextResponse.json({ error: 'La transacción no crea esa configuración' }, { status: 400 })
      }
      const signature = await sendAndConfirm(tx)
      await db.setting.upsert({
        where: { key: CABAL_CONFIG_KEY },
        create: { key: CABAL_CONFIG_KEY, value: body.config },
        update: { value: body.config },
      })
      return NextResponse.json({ ok: true, config: body.config, signature })
    }

    if (body.step === 'claim') {
      const { wallet } = await launchFeeSettings()
      const tx = await buildPartnerClaimTx(wallet, body.mint)
      return NextResponse.json({ ok: true, tx, feeClaimer: wallet })
    }

    return NextResponse.json({ error: 'Paso desconocido' }, { status: 400 })
  } catch (e) {
    return fail(e)
  }
}
