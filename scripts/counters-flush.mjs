#!/usr/bin/env node
// Vuelca a Postgres los contadores acumulados en Redis (PRD §4.2).
// Pensado para un cron o un systemd timer cada 10-30 s:
//   * * * * * cd /ruta/cabal && bun run counters:flush
//
// Con --watch se queda residente y vuelca cada FLUSH_INTERVAL segundos.

import { flushCounters } from '../src/lib/counters.ts'

const interval = Number(process.env.FLUSH_INTERVAL ?? 15) * 1000

async function run() {
  const n = await flushCounters()
  if (n) console.log(`[counters] ${n} filas actualizadas`)
}

if (process.argv.includes('--watch')) {
  console.log(`[counters] volcando cada ${interval / 1000}s`)
  await run()
  setInterval(() => run().catch((e) => console.error(e.message)), interval)
} else {
  await run()
  process.exit(0)
}
