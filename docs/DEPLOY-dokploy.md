# Despliegue en Dokploy

Archivos que intervienen:

| Archivo | Para qué |
|---|---|
| `Dockerfile` | Imagen de producción (multi-stage: deps → builder → runner, + stage `counters`) |
| `docker-entrypoint.sh` | Aplica `prisma migrate deploy` y arranca el servidor |
| `.dockerignore` | Recorta el contexto de build (node_modules, .next, db/, logs…) |
| `docker-compose.dokploy.yml` | Stack completo: app + counters + postgres + pgbouncer + redis |
| `docker-compose.yml` | Sólo infraestructura para desarrollo local (sin la app) |

## Opción A — Compose (recomendada: BD y Redis dentro del stack)

1. Dokploy → **Create → Compose**, conecta el repo, rama `main`.
2. **Compose Path**: `./docker-compose.dokploy.yml`
3. **Environment**: pega estas variables (los `DATABASE_URL` / `DIRECT_URL` / `REDIS_URL` los compone el YAML, no los pongas aquí):

```
POSTGRES_PASSWORD=<una-cadena-larga-aleatoria>
AUTH_SECRET=<openssl rand -base64 32>
APP_ORIGIN=https://tudominio.com
NEXT_PUBLIC_SITE_URL=https://tudominio.com
ADMIN_USER=admin
ADMIN_PASSWORD=<cambiar>
ADMIN_SECRET=<cambiar>
# Opcionales
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
X_CLIENT_ID=
X_CLIENT_SECRET=
SOLANA_RPC_URL=
FLUSH_INTERVAL=15
```

4. **Domains**: añade el dominio apuntando al servicio `app`, puerto `3000`, con HTTPS/Let's Encrypt.
5. **Deploy**.

`NEXT_PUBLIC_SITE_URL` se inlinea en el bundle durante el build: si lo cambias hay
que **redesplegar con rebuild**, no basta con reiniciar.

Sólo `app` está en la red `dokploy-network` (la que ve Traefik). Postgres, PgBouncer
y Redis quedan en la red interna `cabal`, sin puertos publicados en el host.

## Opción B — Application (Dockerfile) con BD gestionada aparte

Si prefieres crear Postgres y Redis como *Databases* de Dokploy:

1. Dokploy → **Create → Application**, Build Type **Dockerfile**, path `./Dockerfile`.
2. Build Args: `NEXT_PUBLIC_SITE_URL=https://tudominio.com`.
3. Environment: además de `AUTH_SECRET`, `APP_ORIGIN`, admin y OAuth, define a mano
   `DATABASE_URL`, `DIRECT_URL` y `REDIS_URL` apuntando a los servicios de Dokploy.
4. Conecta la app a la red de esas bases de datos y publica el puerto `3000`.
5. El worker de contadores se despliega como una segunda Application con el mismo
   Dockerfile y **Docker Build Stage** `counters`.

## Migraciones

El entrypoint ejecuta `prisma migrate deploy` en cada arranque: sólo aplica
migraciones ya versionadas en `prisma/migrations/`, nunca borra datos. Si falla, el
contenedor no arranca (fallo visible en vez de app contra un esquema viejo).

## Backups

`bun run db:backup` (`scripts/pg-backup.mjs`) usa `DIRECT_URL`. Prográmalo desde
Dokploy → Backups sobre el servicio `postgres`, o como cron ejecutando
`docker compose exec app bunx prisma ...` según prefieras.

## Comprobar en local antes de subir

```
docker compose -f docker-compose.dokploy.yml build
POSTGRES_PASSWORD=dev AUTH_SECRET=dev APP_ORIGIN=http://localhost:3000 \
  docker compose -f docker-compose.dokploy.yml up
```
(la red externa `dokploy-network` no existe en local: créala con
`docker network create dokploy-network` o comenta esa red y su referencia en `app`).
