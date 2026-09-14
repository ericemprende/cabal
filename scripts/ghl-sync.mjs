#!/usr/bin/env node
// Sincroniza a Go High Level (GHL) las cuentas con correo que todavía no
// están en el CRM (ghlSyncedAt null) y les pone la etiqueta configurada
// (GHL_TAG, "Cabal" por defecto). Pensado para correr como backfill tras
// activar la integración, o para reintentar las que quedaron con error:
//   bun run ghl:sync

import { syncPendingToGhl } from '../src/lib/ghl.ts'

async function run() {
  if (!process.env.GHL_LOCATION_ID || !process.env.GHL_PRIVATE_TOKEN) {
    console.error('[ghl-sync] faltan GHL_LOCATION_ID y/o GHL_PRIVATE_TOKEN en el entorno (.env)')
    process.exit(1)
  }

  let totalSynced = 0
  let totalFailed = 0
  for (;;) {
    const { synced, failed, remaining } = await syncPendingToGhl(100)
    totalSynced += synced
    totalFailed += failed
    console.log(`[ghl-sync] pasada: ${synced} sincronizados, ${failed} fallidos, ${remaining} pendientes`)
    if (synced + failed === 0 || remaining === 0) break
  }

  console.log(`[ghl-sync] listo: ${totalSynced} sincronizados, ${totalFailed} fallidos en total`)
  process.exit(0)
}

run().catch((e) => {
  console.error('[ghl-sync] error fatal', e)
  process.exit(1)
})
