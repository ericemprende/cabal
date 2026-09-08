#!/usr/bin/env node
// Volcado de datos entre motores (docs/PRD-postgres-redis.md §5, fase F4).
//
//   bun run db:export     # con el esquema en SQLite  -> db/export.json
//   bun run db:import     # con el esquema en Postgres <- db/export.json
//
// Son dos pasos separados a propósito: Prisma solo puede hablar con un provider
// a la vez, así que hay que exportar, cambiar de provider, regenerar el cliente
// y luego importar.

import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const FILE = 'db/export.json'

// Orden de inserción: las tablas padre antes que las que las referencian.
const MODELS = [
  'user',
  'launch',
  'token',
  'post',
  'vote',
  'pointEvent',
  'setting',
  'affiliatePlatform',
  'follow',
  'walletLink',
  'devClaim',
  'projectClaim',
]

const db = new PrismaClient()
const mode = process.argv[2]

async function exportAll() {
  const out = {}
  for (const model of MODELS) {
    out[model] = await db[model].findMany()
    console.log(`  ${model}: ${out[model].length}`)
  }
  writeFileSync(FILE, JSON.stringify(out, null, 2))
  console.log(`\n✓ Exportado a ${FILE}`)
}

async function importAll() {
  if (!existsSync(FILE)) {
    console.error(`⛔ No existe ${FILE}. Ejecuta primero: bun run db:export`)
    process.exit(1)
  }
  const data = JSON.parse(readFileSync(FILE, 'utf8'))

  const existing = await db.user.count()
  if (existing > 0) {
    console.error(`⛔ La base destino ya tiene ${existing} usuarios. Aborto para no duplicar.`)
    process.exit(1)
  }

  for (const model of MODELS) {
    const rows = data[model] ?? []
    if (!rows.length) {
      console.log(`  ${model}: 0`)
      continue
    }

    // `User.referredById` apunta a otro User: si el referido se inserta antes
    // que quien lo refirió, la FK falla. Insertamos sin ese campo y lo
    // reconectamos en una segunda pasada.
    const deferred = model === 'user'
      ? rows.filter((r) => r.referredById).map((r) => ({ id: r.id, referredById: r.referredById }))
      : []
    const payload = model === 'user'
      ? rows.map(({ referredById: _drop, ...rest }) => rest)
      : rows

    // Las fechas viajan como string en JSON; Prisma exige Date en Postgres.
    for (const row of payload) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v)) {
          row[k] = new Date(v)
        }
      }
    }

    await db[model].createMany({ data: payload })
    console.log(`  ${model}: ${payload.length}`)

    for (const { id, referredById } of deferred) {
      await db.user.update({ where: { id }, data: { referredById } })
    }
    if (deferred.length) console.log(`    ↳ ${deferred.length} referidos reconectados`)
  }
  console.log('\n✓ Importación completada')
}

if (mode === 'export') await exportAll()
else if (mode === 'import') await importAll()
else {
  console.error('Uso: db-transfer.mjs <export|import>')
  process.exit(1)
}

await db.$disconnect()
