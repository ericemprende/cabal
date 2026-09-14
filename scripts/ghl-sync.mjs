#!/usr/bin/env node
// Sincroniza a Go High Level (GHL) todos los usuarios de Cabal que ya tienen
// un correo (registro por contraseña con `email`, o cuenta de Google con
// `googleEmail`) y les pone la etiqueta "cabal". Pensado para correr como
// backfill una sola vez tras activar la integración:
//   bun run ghl:sync
//
// Los usuarios sin ningún correo (registro por handle/X sin verificar
// Google) se listan al final pero no se envían — GHL rechaza contactos sin
// email ni teléfono.

import { db } from '../src/lib/db.ts'
import { syncUserToGhl } from '../src/lib/ghl.ts'

async function run() {
  if (!process.env.GHL_LOCATION_ID || !process.env.GHL_PIT) {
    console.error('[ghl-sync] faltan GHL_LOCATION_ID y/o GHL_PIT en el entorno (.env)')
    process.exit(1)
  }

  const users = await db.user.findMany({
    select: { id: true, handle: true, name: true, email: true, googleEmail: true },
  })

  const withEmail = users.filter((u) => u.email || u.googleEmail)
  const withoutEmail = users.length - withEmail.length

  console.log(`[ghl-sync] ${users.length} usuarios en total, ${withEmail.length} con correo para sincronizar`)

  let ok = 0
  for (const u of withEmail) {
    const email = (u.email ?? u.googleEmail).toLowerCase()
    try {
      await syncUserToGhl({ email, name: u.name, handle: u.handle })
      ok++
      console.log(`  ✓ @${u.handle} <${email}>`)
    } catch (e) {
      console.error(`  ✗ @${u.handle} <${email}>: ${e.message}`)
    }
  }

  console.log(`[ghl-sync] listo: ${ok}/${withEmail.length} sincronizados, ${withoutEmail} usuarios sin correo (no enviados)`)
  process.exit(0)
}

run().catch((e) => {
  console.error('[ghl-sync] error fatal', e)
  process.exit(1)
})
