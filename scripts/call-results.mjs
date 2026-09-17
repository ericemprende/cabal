#!/usr/bin/env node
// Revisa y guarda el resultado de las calls (ranking de Top Callers y
// estadísticas del perfil). La web ya lanza pasadas sola al visitar el
// ranking o un perfil; esto sirve para ponerlo al día a mano o como proceso aparte:
//   bun run calls:sync            una pasada grande
//   bun run calls:watch           residente, cada CALLS_INTERVAL segundos

import { syncCallResults } from '../src/lib/call-results.ts'

const interval = Number(process.env.CALLS_INTERVAL ?? 90) * 1000

async function run(limit) {
  const n = await syncCallResults(limit)
  if (n) console.log(`[calls] ${n} call(s) revisadas`)
  return n
}

if (process.argv.includes('--watch')) {
  console.log(`[calls] revisando cada ${interval / 1000}s`)
  await run()
  setInterval(() => run().catch((e) => console.error(e.message)), interval)
} else {
  // Hasta vaciar la cola, respetando el límite de GeckoTerminal (~30 req/min)
  let total = 0
  for (;;) {
    const n = await run(6)
    total += n
    if (n === 0) break
    await new Promise((r) => setTimeout(r, 60_000))
  }
  console.log(`[calls] listo: ${total} call(s) revisadas`)
  process.exit(0)
}
