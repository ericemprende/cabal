/**
 * auto-backup — copia de seguridad de la BD al arrancar el dev server.
 * Se ejecuta desde `bun run dev` antes de `next dev`. Guarda como máximo
 * un backup por hora en db/backups/auto-*.db (conserva los 30 últimos).
 * Nunca falla el arranque: si algo sale mal, solo avisa por consola.
 */
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = '/home/z/my-project/db/custom.db';
const BACKUP_DIR = '/home/z/my-project/db/backups';

try {
  if (!fs.existsSync(DB_PATH)) {
    console.warn('[auto-backup] No hay BD en db/custom.db, nada que respaldar.');
    process.exit(0);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // Máx. 1 backup automático por hora
  const hour = new Date().toISOString().slice(0, 13);
  const existing = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith(`auto-${hour}`));
  if (existing.length > 0) {
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, `auto-${stamp}.db`));
  console.log(`[auto-backup] ✅ Backup de la BD: db/backups/auto-${stamp}.db`);

  // Conservar solo los 30 backups automáticos más recientes
  const autos = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('auto-')).sort();
  while (autos.length > 30) {
    const oldest = autos.shift();
    fs.unlinkSync(path.join(BACKUP_DIR, oldest));
  }
} catch (err) {
  console.warn('[auto-backup] Aviso: no se pudo crear el backup:', err?.message ?? err);
}
