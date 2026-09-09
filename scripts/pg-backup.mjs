#!/usr/bin/env node
// Backup de PostgreSQL con pg_dump (sustituye a la copia de archivo de SQLite
// que hacía scripts/auto-backup.mjs, inservible en Postgres).
//
//   bun run db:backup
//
// Formato custom (-Fc): comprimido y restaurable con pg_restore de forma
// selectiva. Restaurar:
//   pg_restore -d "$DIRECT_URL" --clean --if-exists db/backups/<archivo>.dump

import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import path from 'node:path'

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Define DIRECT_URL o DATABASE_URL en .env')
  process.exit(1)
}

const DIR = 'db/backups'
const KEEP = 20 // backups a conservar; los mas antiguos se borran
mkdirSync(DIR, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = path.join(DIR, `cabal-${stamp}.dump`)

// pg_dump no entiende los parametros de Prisma (schema, pgbouncer...).
const clean = url.replace(/[?&](schema|pgbouncer|connection_limit)=[^&]*/g, '')

const bin = process.env.PG_BIN ? path.join(process.env.PG_BIN, 'pg_dump') : 'pg_dump'
const r = spawnSync(bin, ['-Fc', '-f', out, clean], { stdio: 'inherit', shell: true })

if (r.status !== 0) {
  console.error('pg_dump fallo. Esta en el PATH? Si no, define PG_BIN con su carpeta.')
  process.exit(1)
}

console.log(`Backup: ${out} (${(statSync(out).size / 1024).toFixed(1)} KB)`)

const old = readdirSync(DIR)
  .filter((f) => f.endsWith('.dump'))
  .sort()
  .slice(0, -KEEP)
for (const f of old) {
  unlinkSync(path.join(DIR, f))
  console.log(`  borrado antiguo: ${f}`)
}
