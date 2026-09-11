#!/usr/bin/env node
// Avisos Premium de lanzamientos por correo (10 y 5 minutos antes).
// Pensado para un proceso aparte en producción (igual que counters-flush):
//   bun run alerts:watch
//
// Sin --watch hace una sola pasada y termina (para un cron externo).

import { sendDueLaunchAlerts } from '../src/lib/launch-alerts.ts'

const interval = Number(process.env.ALERTS_INTERVAL ?? 30) * 1000

async function run() {
  const { checked, sent } = await sendDueLaunchAlerts()
  if (checked || sent) console.log(`[alerts] ${checked} launch(es) en ventana, ${sent} correo(s) enviados`)
}

if (process.argv.includes('--watch')) {
  console.log(`[alerts] sondeando cada ${interval / 1000}s`)
  await run()
  setInterval(() => run().catch((e) => console.error(e.message)), interval)
} else {
  await run()
  process.exit(0)
}
