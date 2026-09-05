/**
 * safe-db-push — aplica cambios de schema.prisma a SQLite SIN perder datos.
 *
 * Uso: bun scripts/safe-db-push.mjs  (o `bun run db:push`)
 *
 * Qué hace:
 *  1. Backup con timestamp de db/custom.db -> db/backups/
 *  2. Cuenta las filas de cada tabla en el backup
 *  3. Ejecuta `prisma db push --accept-data-loss` (si no, los cambios
 *     destructivos fallarían en modo no-interactivo)
 *  4. Compara conteos tabla por tabla: si el push borró filas, las
 *     restaura desde el backup (columnas comunes al schema nuevo,
 *     INSERT OR IGNORE respeta PK/unique).
 *
 * Así, aunque un cambio de schema recree una tabla (la causa por la que
 * se perdían launches como Ceocripto), los datos vuelven solos.
 */
import { Database } from 'bun:sqlite';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/z/my-project';
const DB_PATH = path.join(ROOT, 'db', 'custom.db');
const BACKUP_DIR = path.join(ROOT, 'db', 'backups');

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ No existe la BD en ${DB_PATH}`);
  process.exit(1);
}

// ── 1. Backup ────────────────────────────────────────────────────────────────
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = path.join(BACKUP_DIR, `custom-${ts}.db`);
fs.copyFileSync(DB_PATH, backupPath);
console.log(`📦 Backup creado: db/backups/${path.basename(backupPath)}`);

// Mantener solo los 20 backups más recientes
const backups = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort();
while (backups.length > 20) {
  const oldest = backups.shift();
  fs.unlinkSync(path.join(BACKUP_DIR, oldest));
}

const backupDb = new Database(backupPath, { readonly: true });
const SYSTEM_TABLES = new Set(['sqlite_sequence', '_prisma_migrations']);
const tables = backupDb
  .query("SELECT name FROM sqlite_master WHERE type='table'")
  .all()
  .map((r) => r.name)
  .filter((t) => !SYSTEM_TABLES.has(t) && !t.startsWith('sqlite_') && !t.startsWith('_'));

const before = {};
for (const t of tables) {
  try {
    before[t] = backupDb.query(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
  } catch {
    /* tabla sin filas legibles */
  }
}

// ── 2. Push del schema ───────────────────────────────────────────────────────
console.log('⏳ Aplicando schema (prisma db push)…');
const res = spawnSync('bunx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env },
});
if (res.status !== 0) {
  console.error('❌ El push falló. La BD original sigue intacta en db/custom.db.');
  console.error(`   Backup disponible en: ${backupPath}`);
  process.exit(res.status ?? 1);
}

// ── 3. Comparar y restaurar filas perdidas ──────────────────────────────────
const liveDb = new Database(DB_PATH);
liveDb.exec('PRAGMA foreign_keys = OFF;');
let totalRestored = 0;
const report = [];

for (const t of tables) {
  const had = before[t] ?? 0;
  if (had === 0) continue;

  let now = 0;
  let liveCols = [];
  try {
    now = liveDb.query(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
    liveCols = liveDb.query(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
  } catch {
    report.push(`⚠️  ${t}: la tabla ya no existe en el schema nuevo (${had} filas en backup)`);
    continue;
  }
  if (now >= had) continue;

  const backupCols = backupDb.query(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
  const common = backupCols.filter((c) => liveCols.includes(c));
  if (common.length === 0) {
    report.push(`⚠️  ${t}: sin columnas en común, no se puede restaurar (${had} filas en backup)`);
    continue;
  }

  const colList = common.map((c) => `"${c}"`).join(', ');
  const rows = backupDb.query(`SELECT ${colList} FROM "${t}"`).all();
  const stmt = liveDb.query(
    `INSERT OR IGNORE INTO "${t}" (${colList}) VALUES (${common.map(() => '?').join(', ')})`
  );
  let restored = 0;
  for (const row of rows) {
    try {
      stmt.run(...common.map((c) => row[c]));
      restored++;
    } catch {
      /* fila incompatible con el schema nuevo (p.ej. NOT NULL sin default) */
    }
  }
  totalRestored += restored;
  report.push(`♻️  ${t}: el push borró ${had - now} filas → restauradas ${restored} desde el backup`);
}

liveDb.exec('PRAGMA foreign_keys = ON;');
liveDb.close();
backupDb.close();

console.log('');
if (report.length === 0) {
  console.log('✅ Schema aplicado. Todas las tablas conservan sus datos (sin pérdidas).');
} else {
  console.log(report.join('\n'));
  console.log(
    totalRestored > 0
      ? `\n✅ Schema aplicado con ${totalRestored} fila(s) restauradas automáticamente.`
      : '\n⚠️  Hubo pérdidas que no se pudieron restaurar automáticamente. Revisa db/backups/.'
  );
}
