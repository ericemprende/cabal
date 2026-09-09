#!/bin/sh
# Aplica las migraciones pendientes y arranca la app.
# `migrate deploy` sólo aplica migraciones ya versionadas: nunca borra datos.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] aplicando migraciones (prisma migrate deploy)..."
  # migrate necesita una sesión persistente: usa DIRECT_URL si existe.
  bunx prisma migrate deploy || {
    echo "[entrypoint] fallo al migrar. Abortando." >&2
    exit 1
  }
else
  echo "[entrypoint] DATABASE_URL no definida: se omiten migraciones." >&2
fi

exec "$@"
