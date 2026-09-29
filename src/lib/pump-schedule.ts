import type { PumpCoin } from '@prisma/client'
import { db } from '@/lib/db'
import { awardPoints } from '@/lib/api-helpers'
import { invalidate } from '@/lib/cache'
import { coinExistsOnChain, sendCreateTxs } from '@/lib/pump-launch'
import { createTokenForLaunch } from '@/lib/tokens-sync'

/**
 * Lanzamientos de pump.fun: publicarlos en el Radar y mandar los programados
 * a su hora.
 *
 * Un programado se firma entero al programarlo (con nonces duraderos, ver
 * lib/pump-launch.ts), así que aquí solo se retransmiten bytes ya firmados:
 * el servidor no tiene ninguna clave y no puede cambiar nada de la
 * transacción. Su launch sale en el Radar desde que se programa, sin el
 * contrato: si se publicara antes, los bots podrían preparar la compra.
 */

function launchData(coin: PumpCoin) {
  return {
    name: coin.name,
    ticker: coin.symbol,
    image: coin.image,
    submitterRole: 'dev',
    devWallet: coin.creatorWallet,
    launchpad: 'pump.fun',
    network: 'solana',
    dateConfirmed: true,
    description: coin.description || `${coin.name} ($${coin.symbol}), lanzado en pump.fun desde Cabal.`,
    website: coin.website,
    twitter: coin.twitter,
    telegram: coin.telegram,
  }
}

/** Launch "próximo" en el Radar para un programado, todavía sin contrato. */
export async function createScheduledLaunch(coin: PumpCoin, scheduledAt: Date): Promise<string> {
  const launch = await db.launch.create({
    data: { ...launchData(coin), launchAt: scheduledAt, createdById: coin.userId },
  })
  await awardPoints(coin.userId, 'launch', `Programaste ${coin.name} ($${coin.symbol}) en pump.fun`)
  await invalidate('launches:*')
  return launch.id
}

/**
 * El token ya existe en la red: se marca lanzado y su launch del Radar pasa a
 * tener contrato (o se crea, si fue al momento). Devuelve el id del launch.
 */
export async function markLaunched(coin: PumpCoin, signature: string | null): Promise<string> {
  const now = new Date()
  let launchId = coin.launchId
  if (launchId) {
    await db.launch.update({ where: { id: launchId }, data: { contract: coin.mint, launchAt: now, hidden: false } })
  } else {
    const created = await db.launch.create({
      data: { ...launchData(coin), contract: coin.mint, launchAt: now, createdById: coin.userId },
    })
    launchId = created.id
    await awardPoints(coin.userId, 'launch', `Lanzaste ${coin.name} ($${coin.symbol}) en pump.fun`)
  }
  await db.pumpCoin.update({
    where: { mint: coin.mint },
    data: { status: 'launched', launchedAt: now, signature, launchId, error: null },
  })
  const launch = await db.launch.findUnique({ where: { id: launchId } })
  if (launch) await createTokenForLaunch(launch).catch((e) => console.error('[pump] token', e))
  await invalidate('launches:*')
  return launchId
}

/** Manda un programado que ya toca. Solo lo coge quien lo pasa de scheduled a sending. */
async function fireScheduled(coin: PumpCoin) {
  const claimed = await db.pumpCoin.updateMany({ where: { mint: coin.mint, status: 'scheduled' }, data: { status: 'sending' } })
  if (!claimed.count) return
  try {
    const { signature, buyError } = await sendCreateTxs(coin.signedTxs, coin.mint, coin.creatorWallet)
    await markLaunched(coin, signature)
    if (buyError) await db.pumpCoin.update({ where: { mint: coin.mint }, data: { error: buyError } })
    console.log(`[pump] lanzado ${coin.symbol} ${coin.mint}`)
  } catch (e) {
    // Pudo entrar aunque la espera fallara: se mira en la red antes de darlo por perdido
    if (await coinExistsOnChain(coin.mint).catch(() => false)) {
      await markLaunched(coin, null)
      return
    }
    const msg = (e as Error).message || 'Error desconocido'
    console.error(`[pump] falló el programado ${coin.mint}:`, msg)
    await db.pumpCoin.update({
      where: { mint: coin.mint },
      data: { status: 'failed', error: `No se pudo lanzar: ${msg}. Revisa el saldo de tu wallet y vuelve a programarlo.` },
    })
    if (coin.launchId) await db.launch.update({ where: { id: coin.launchId }, data: { hidden: true } }).catch(() => {})
    await invalidate('launches:*')
  }
}

export async function runPumpSchedulerTick() {
  const due = await db.pumpCoin.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
    take: 10,
  })
  await Promise.all(due.map(fireScheduled))
}

const g = globalThis as unknown as { __cabalPumpScheduler?: boolean }

/** Cada 3 s: la precisión con la que sale un programado. */
export function startPumpScheduler() {
  if (g.__cabalPumpScheduler) return
  g.__cabalPumpScheduler = true
  let running = false
  setInterval(async () => {
    if (running) return
    running = true
    try {
      await runPumpSchedulerTick()
    } catch (e) {
      console.error('[pump] pasada fallida:', (e as Error).message)
    } finally {
      running = false
    }
  }, 3000)
  console.log('[pump] programador de lanzamientos activo (cada 3s)')
}
