import { NextResponse } from 'next/server'
import { VersionedTransaction } from '@solana/web3.js'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { buildCreateTxs, buildNonceWithdrawTx, buildScheduleSetupTx, readNonces, sendAndConfirm, txCount } from '@/lib/pump-launch'
import { parsePumpForm, pubkey } from '@/lib/pump-input'
import { createScheduledLaunch } from '@/lib/pump-schedule'
import { invalidate } from '@/lib/cache'
import type { LaunchPlatformId } from '@/lib/launch-platforms'
import { cabalPendingFees } from '@/lib/cabal-launch'

export const runtime = 'nodejs'

const MIN_AHEAD_MS = 3 * 60_000
const MAX_AHEAD_MS = 7 * 24 * 3600_000

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

function decode(b64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(Buffer.from(b64, 'base64'))
}

/**
 * POST /api/pump/schedule — programar un lanzamiento en pump.fun, en tres
 * pasos (`step`), con dos firmas del creador:
 *
 * 1. `setup`: guarda el formulario y la hora, y devuelve la transacción que
 *    crea los nonces duraderos y cobra la comisión de Cabal.
 * 2. `commit`: manda esa transacción ya firmada y devuelve las del
 *    lanzamiento, armadas sobre los nonces (no caducan).
 * 3. `finalize`: guarda las del lanzamiento firmadas (creador + mint) y
 *    publica el launch en el Radar. El programador las manda a su hora.
 *
 * `cancel` devuelve la transacción que retira el alquiler de los nonces, lo
 * que además invalida las transacciones guardadas.
 */
export async function POST(req: Request) {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return bad('Inicia sesión para lanzar un token', 401)
  const limit = await rateLimit(`pump-schedule:${userId}`, 30, 600)
  if (!limit.ok) return tooManyRequests(limit)

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  try {
    switch (body.step) {
      case 'setup':
        return await setup(userId, body)
      case 'commit':
        return await commit(userId, body)
      case 'finalize':
        return await finalize(userId, body)
      case 'cancel':
        return await cancel(userId, body)
      default:
        return bad('Paso desconocido')
    }
  } catch (e) {
    console.error('[pump/schedule]', body.step, e)
    return bad((e as Error).message || 'No se pudo programar el lanzamiento', 500)
  }
}

async function setup(userId: string, body: Record<string, unknown>) {
  const parsed = parsePumpForm(body)
  if (!parsed.ok) return bad(parsed.error)
  const { mint, creator, ...data } = parsed.data

  const scheduledAt = new Date(String(body.scheduledAt ?? ''))
  const ahead = scheduledAt.getTime() - Date.now()
  if (!Number.isFinite(ahead)) return bad('Elige la fecha y la hora del lanzamiento')
  if (ahead < MIN_AHEAD_MS) return bad('Prográmalo con al menos 3 minutos de margen, o lánzalo ahora')
  if (ahead > MAX_AHEAD_MS) return bad('Se puede programar hasta 7 días antes')

  // Un nonce por transacción del lanzamiento: cuántas son depende de la
  // plataforma y de si hay compra inicial. El navegador manda de sobra y aquí
  // se usan las que hagan falta.
  const needed = await txCount({ ...data, mint, creator })
  const offered = (Array.isArray(body.nonceAccounts) ? body.nonceAccounts : []).map(pubkey)
  const nonceAccounts = offered.slice(0, needed)
  if (nonceAccounts.length !== needed || nonceAccounts.some((a) => !a || a === mint || a === creator)) {
    return bad('Faltan datos para programar')
  }

  const existing = await db.pumpCoin.findUnique({ where: { mint } })
  if (existing && (existing.userId !== userId || existing.status !== 'draft' || existing.feeSignature)) {
    return bad('Esa dirección de token ya está usada', 409)
  }
  const fields = { ...data, creatorWallet: creator, scheduledAt, nonceAccounts: nonceAccounts as string[], signedTxs: [] }
  await db.pumpCoin.upsert({ where: { mint }, create: { mint, userId, ...fields }, update: fields })

  const { tx, feeSol } = await buildScheduleSetupTx({ platform: data.platform, creator, nonceAccounts: nonceAccounts as string[] })
  await db.pumpCoin.update({ where: { mint }, data: { feeSol } })
  return NextResponse.json({ ok: true, tx, feeSol, nonceAccounts })
}

async function commit(userId: string, body: Record<string, unknown>) {
  const coin = await db.pumpCoin.findUnique({ where: { mint: String(body.mint ?? '') } })
  if (!coin || coin.userId !== userId || coin.status !== 'draft' || !coin.scheduledAt) return bad('Programado no encontrado', 404)

  if (!coin.feeSignature) {
    if (typeof body.tx !== 'string') return bad('Falta la transacción firmada')
    const tx = decode(body.tx)
    const keys = tx.message.staticAccountKeys.map((k) => k.toBase58())
    if (keys[0] !== coin.creatorWallet || coin.nonceAccounts.some((a) => !keys.includes(a))) {
      return bad('La transacción no corresponde a este lanzamiento')
    }
    const feeSignature = await sendAndConfirm(tx)
    await db.pumpCoin.update({ where: { mint: coin.mint }, data: { feeSignature } })
  }

  const nonces = await readNonces(coin.nonceAccounts)
  const { txs } = await buildCreateTxs({
    platform: coin.platform as LaunchPlatformId,
    mint: coin.mint,
    creator: coin.creatorWallet,
    name: coin.name,
    symbol: coin.symbol,
    initialBuySol: coin.initialBuySol,
    chargeFee: false,
    nonces,
  })
  // Plantilla sin firmar: finalize solo acepta estas mismas transacciones
  await db.pumpCoin.update({ where: { mint: coin.mint }, data: { signedTxs: txs } })
  return NextResponse.json({ ok: true, txs })
}

async function finalize(userId: string, body: Record<string, unknown>) {
  const coin = await db.pumpCoin.findUnique({ where: { mint: String(body.mint ?? '') } })
  if (!coin || coin.userId !== userId || coin.status !== 'draft' || !coin.feeSignature || !coin.scheduledAt) {
    return bad('Programado no encontrado', 404)
  }
  const signed = Array.isArray(body.txs) ? (body.txs as unknown[]).filter((t): t is string => typeof t === 'string') : []
  if (signed.length !== coin.signedTxs.length) return bad('Faltan transacciones firmadas')
  for (let i = 0; i < signed.length; i++) {
    const a = Buffer.from(decode(signed[i]).message.serialize())
    const b = Buffer.from(decode(coin.signedTxs[i]).message.serialize())
    if (!a.equals(b)) return bad('Las transacciones firmadas no son las que armó Cabal')
  }
  const launchId = await createScheduledLaunch(coin, coin.scheduledAt)
  await db.pumpCoin.update({ where: { mint: coin.mint }, data: { signedTxs: signed, status: 'scheduled', launchId } })
  return NextResponse.json({ ok: true, launchId, scheduledAt: coin.scheduledAt.toISOString() })
}

async function cancel(userId: string, body: Record<string, unknown>) {
  const coin = await db.pumpCoin.findUnique({ where: { mint: String(body.mint ?? '') } })
  if (!coin || coin.userId !== userId) return bad('Programado no encontrado', 404)
  if (!coin.nonceAccounts.length) return bad('Este lanzamiento no tiene nada que cancelar ni recuperar')

  // Un programado que todavía no salió se para aquí mismo; uno ya lanzado solo
  // recupera el alquiler de sus nonces
  if (coin.status !== 'launched') {
    const stopped = await db.pumpCoin.updateMany({
      where: { mint: coin.mint, status: { in: ['draft', 'scheduled', 'failed'] } },
      data: { status: 'cancelled' },
    })
    if (!stopped.count && coin.status !== 'cancelled') return bad('Se está lanzando ahora mismo; ya no se puede cancelar', 409)
    if (coin.launchId) {
      await db.launch.update({ where: { id: coin.launchId }, data: { hidden: true } }).catch(() => {})
      await invalidate('launches:*')
    }
  }
  try {
    const tx = await buildNonceWithdrawTx(coin.creatorWallet, coin.nonceAccounts)
    return NextResponse.json({ ok: true, tx })
  } catch (e) {
    // Ya se retiró todo: se olvidan los nonces para no ofrecerlo más
    await db.pumpCoin.update({ where: { mint: coin.mint }, data: { nonceAccounts: [] } })
    return bad((e as Error).message, 409)
  }
}

/** GET /api/pump/schedule — los lanzamientos del usuario, para ver su estado. */
export async function GET() {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json([])
  const coins = await db.pumpCoin.findMany({
    where: { userId, status: { not: 'draft' } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json(
    await Promise.all(coins.map(async (c) => ({
      mint: c.status === 'launched' ? c.mint : null,
      key: c.mint,
      platform: c.platform,
      name: c.name,
      symbol: c.symbol,
      image: c.image,
      status: c.status,
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
      launchedAt: c.launchedAt?.toISOString() ?? null,
      error: c.error,
      hasNonces: c.nonceAccounts.length > 0,
      // Cabal Launch: lo que el dev tiene por reclamar (su 70 % de las comisiones)
      creatorFeesSol:
        c.platform === 'cabal' && c.status === 'launched' ? ((await cabalPendingFees(c.mint))?.creatorSol ?? 0) : null,
    }))),
  )
}
