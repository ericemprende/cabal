#!/usr/bin/env node
// Cambia el datasource de prisma/schema.prisma entre SQLite y PostgreSQL.
// Prisma no permite elegir el provider en tiempo de ejecución, así que el
// cambio es textual sobre el esquema. Ver docs/PRD-postgres-redis.md §5 (F2).
//
//   bun run db:use-postgres
//   bun run db:use-sqlite

import { readFileSync, writeFileSync } from 'node:fs'

const SCHEMA = 'prisma/schema.prisma'
const target = process.argv[2]

const BLOCKS = {
  sqlite: `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`,
  postgresql: `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  // Conexión directa para \`prisma migrate\`: las migraciones necesitan una
  // sesión persistente y no funcionan a través de PgBouncer en modo transaction.
  directUrl = env("DIRECT_URL")
}`,
}

if (!BLOCKS[target]) {
  console.error('Uso: db-provider.mjs <sqlite|postgresql>')
  process.exit(1)
}

const schema = readFileSync(SCHEMA, 'utf8')
const current = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/)?.[1]

if (current === target) {
  console.log(`✓ El esquema ya usa ${target}. Sin cambios.`)
  process.exit(0)
}

const replaced = schema.replace(/datasource db \{[\s\S]*?\n\}/, BLOCKS[target])
if (replaced === schema) {
  console.error('⛔ No se pudo localizar el bloque `datasource db` en el esquema.')
  process.exit(1)
}

writeFileSync(SCHEMA, replaced)
console.log(`✓ Esquema cambiado a ${target}.`)

if (target === 'postgresql') {
  console.log(`
Siguientes pasos:
  1. Define DATABASE_URL y DIRECT_URL en .env (ver .env.example).
  2. Levanta la base:      docker compose up -d postgres pgbouncer redis
  3. Vuelca los datos:     bun run db:migrate-data   (antes de crear el esquema nuevo)
  4. Crea la migración:    bun run db:migrate --name init
  5. Regenera el cliente:  bun run db:generate`)
} else {
  console.log('\nRecuerda apuntar DATABASE_URL a file:/ruta/absoluta/db/custom.db')
}
