# PRD — Migración a PostgreSQL + Redis

**Proyecto:** Cabal
**Autor:** ericemprende
**Fecha:** 2026-09-08
**Estado:** Propuesta

---

## 1. Contexto

Cabal corre hoy sobre **SQLite** (`prisma/schema.prisma`, archivo `db/custom.db`) con
Prisma 6, Next.js 16 en modo `standalone` detrás de Caddy, 41 rutas API y 36 consultas
`findMany`. El esquema tiene 12 modelos y **ningún índice secundario**: solo claves
primarias y restricciones `@@unique`.

El objetivo declarado es soportar **miles de usuarios concurrentes** y un volumen alto de
registros (posts, votos, eventos de puntos).

### Por qué SQLite no llega

- **Un solo escritor por base de datos.** Las lecturas concurrentes funcionan bien con WAL,
  pero el camino caliente de Cabal escribe constantemente: `Vote`, `Post`, `PointEvent` y
  los contadores `likes` / `hype` / `points`. Con concurrencia real esto degenera en una
  cola de escrituras y errores `SQLITE_BUSY`.
- **Sin escalado horizontal.** El archivo vive en el disco de una única máquina: no hay
  réplicas de lectura ni posibilidad de correr más de una instancia de la app.
- **Backups frágiles.** `scripts/auto-backup.mjs` copia el archivo; con escrituras activas
  eso no garantiza una copia consistente.

---

## 2. Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| O1 | Escrituras concurrentes sin bloqueo global | 0 errores de contención bajo 500 escrituras/s |
| O2 | Consultas de feed y leaderboard con índices | p95 < 100 ms con 1 M de filas en `Post` |
| O3 | Escalado horizontal de la app | ≥ 2 instancias de Next sirviendo la misma base |
| O4 | Contadores calientes sin serializar escrituras | `hype` / `likes` sin `UPDATE` por evento |
| O5 | Backups consistentes y restaurables | Restauración verificada desde `pg_dump` |

### No objetivos

- Migrar a un motor NoSQL (Mongo, Cassandra) o analítico (ClickHouse). No hay caso de uso.
- Sharding o multi-región. Prematuro.
- Reescribir la lógica de negocio: la migración es de infraestructura y esquema.

---

## 3. Arquitectura propuesta

### PostgreSQL — verdad persistente

Todos los modelos actuales: `User`, `Launch`, `Token`, `Post`, `Vote`, `PointEvent`,
`Setting`, `AffiliatePlatform`, `Follow`, `WalletLink`, `DevClaim`, `ProjectClaim`.

Ventajas concretas sobre SQLite en este proyecto:

- **MVCC**: escrituras concurrentes reales, sin lock global.
- **Índices compuestos y parciales** para los feeds ordenados por `createdAt`.
- **`JSONB`** para `AffiliatePlatform.links`, hoy almacenado como string JSON.
- **Transacciones serias** para la asignación de puntos (`PointEvent` + `User.points`).
- **Réplicas de lectura** cuando el leaderboard y los feeds dominen la carga.

### Redis — estado caliente

| Uso | Detalle |
|---|---|
| Caché de lecturas | Leaderboard y feeds; hoy cada request pega a disco |
| Contadores | `likes` / `hype` / views con `INCR`, volcado por lotes a Postgres |
| Rate limiting | Protección de las 41 rutas API |
| Sesiones | next-auth (hoy sin estrategia declarada en el código) |
| Locks de idempotencia | Evitar doble asignación de puntos |
| Pub/Sub | Requisito para activar WebSockets con más de una instancia de Next |

> Sin Pub/Sub, el ejemplo de `examples/websocket/` no puede pasar de una sola instancia:
> cada proceso tendría su propio conjunto aislado de conexiones.

---

## 4. Trabajo requerido

### 4.1 Índices (bloqueante, aplica en ambos motores)

Sin esto, las consultas hacen escaneo completo de tabla y Postgres no mejora nada.

```prisma
// Post
@@index([launchId, createdAt])
@@index([tokenId, createdAt])
@@index([userId, createdAt])
// Vote
@@index([target, targetId])
// PointEvent
@@index([userId, createdAt])
// Launch
@@index([status, launchAt])
@@index([createdById])
// Token
@@index([devId])
@@index([contract])
// User
@@index([points])        // leaderboard
@@index([referredById])  // árbol de referidos
```

### 4.2 Contadores en fila caliente

`Launch.hype`, `Post.likes` y `User.points` se actualizan con `UPDATE` sobre la misma fila.
Un launch popular con mil personas dando hype simultáneamente **serializa esas escrituras
también en Postgres**. Estrategia: acumular en Redis (`INCR`) y persistir el agregado cada
N segundos, o escribir eventos append-only y materializar el total.

### 4.3 Pooling de conexiones

Postgres agota conexiones mucho antes que CPU. Se requiere **PgBouncer** en modo
`transaction` entre Prisma y la base (o el pooler gestionado de Neon / Supabase).
`src/lib/db.ts` ya reutiliza el `PrismaClient` vía singleton global, que es correcto.

### 4.4 Migraciones y backups

- Sustituir `bun run db:push` por **migraciones versionadas** (`prisma migrate`). Con datos
  reales, `db push` deja de ser aceptable.
- `scripts/safe-db-push.mjs` y `scripts/auto-backup.mjs` (copia de archivo) quedan
  obsoletos: en Postgres se usa `pg_dump` o snapshots del proveedor.

---

## 5. Plan de ejecución

| Fase | Trabajo | Riesgo |
|---|---|---|
| F1 | Añadir los índices de §4.1 al esquema actual | Bajo |
| F2 | Cambiar `provider` a `postgresql`, ajustar `DATABASE_URL` | Bajo |
| F3 | `prisma migrate dev` — primera migración versionada | Bajo |
| F4 | Volcar datos actuales (155 KB) con un script de Prisma | Bajo |
| F5 | PgBouncer + variables de pooling | Medio |
| F6 | Redis: caché de leaderboard y rate limiting | Bajo |
| F7 | Redis: contadores calientes (§4.2) | Medio — toca lógica de puntos |
| F8 | Redis Pub/Sub + WebSockets, si se activan | Medio |

Las fases F6–F8 son incrementales y no bloquean el corte a Postgres.

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Diferencias de tipos SQLite → Postgres (fechas, `Float`) | Verificar tras el volcado de F4 |
| Agotamiento de conexiones bajo carga | PgBouncer desde el primer día en producción |
| Coste operativo: dos servicios nuevos que mantener | Empezar con Postgres; Redis solo cuando haya señal de carga |
| Pérdida de datos en la migración | Backup del `.db` antes de F4; migración ensayada en local |

**Nota de oportunidad:** hoy `db/custom.db` pesa 155 KB. Si el proyecto sigue en prototipo
sin usuarios reales, la decisión técnicamente correcta sigue siendo Postgres + Redis, pero
el momento correcto es cuando haya tráfico real o justo antes de abrir al público. Los
índices de §4.1, en cambio, conviene aplicarlos ya.

---

## 7. Variables de entorno

Definidas en `.env.example`. Ver ese archivo para los valores de referencia.

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión Postgres de la app (vía PgBouncer si hay pooler) |
| `DIRECT_URL` | Sí (con pooler) | Conexión directa, la usa `prisma migrate` |
| `REDIS_URL` | No (F6+) | Conexión Redis; sin ella la app opera sin caché |
| `AUTH_SECRET` | Sí | Secreto de next-auth |
| `APP_ORIGIN` | Sí | Origen público de la app |

---

## 8. Estado de implementación

SQLite queda **retirado**: no había datos reales que conservar, así que se cortó
directamente a PostgreSQL en vez de migrar por fases.

### Entorno activo (local)

| Pieza | Detalle |
|---|---|
| PostgreSQL 17 | Cluster propio en `C:/Users/ERICK/AppData/Local/cabal-pg/data`, puerto 5432, usuario y base `cabal` |
| Redis 7 | Servicio de Windows ya existente, puerto 6379 |
| PgBouncer | **No desplegado en local.** `docker-compose.yml` lo deja listo para producción |

El cluster de DBngin que había instalado no arrancaba: su directorio de datos
(`C:/Users/ERICK/.antigravity/plataforma para vender extreming 2.9`) no existe.
Se creó uno nuevo con sus mismos binarios en vez de reparar el servicio.

### Entregado

| Fase | Artefacto |
|---|---|
| F1 | 21 índices en `prisma/schema.prisma`, verificados en Postgres (42 índices totales, 13 tablas) |
| F2 | `provider = "postgresql"` con `directUrl`; el conmutador SQLite ya no hace falta |
| F3 | Migración inicial `prisma/migrations/20260908220547_init` aplicada |
| F4 | Sin volcado de datos: se partió de base vacía |
| F5 | `docker-compose.yml` con Postgres + PgBouncer (transaction) + Redis, para producción |
| F6 | `cached()` en feed, leaderboard y lista de launches; `rateLimit()` en hype, like, posts, login y registro |
| F7 | `bump()` / `pending()` sustituyen los `UPDATE` de `Launch.hype` y `Post.likes`; volcado con `counters:watch` |
| F8 | `publish()` / `subscriber()` listos en `src/lib/redis.ts` (sin rutas WebSocket todavía) |

**Criterio de caché:** solo se cachea lo compartido entre usuarios (lista de
posts, tabla de usuarios, launches visibles). Los votos y follows son personales
y se leen siempre en fresco — cachearlos filtraría los likes de un usuario a otro.

### Retirado

Eliminados `scripts/auto-backup.mjs`, `scripts/safe-db-push.mjs`, `db/custom.db`
y sus backups. El respaldo ahora es `scripts/pg-backup.mjs` (`bun run db:backup`,
formato `-Fc` restaurable con `pg_restore`), verificado en ejecución.

También se corrigió `src/lib/seed.ts`: creaba el usuario `elprofe` sin asignarlo
a una variable, y el seed abortaba a media ejecución. En SQLite no se notaba
porque la base ya estaba poblada; contra un Postgres vacío rompía toda la API.

### Pendiente

- **Modelo `WaitlistEntry`**: las rutas de `src/app/api/waitlist/` y
  `src/lib/waitlist.ts` usan `db.waitlistEntry`, que no existe en el esquema.
  Esas rutas devolverán error 500. Es trabajo aparte, ajeno a esta migración.
- **PgBouncer en producción**: en local la app va directa a Postgres. Sin pooler,
  el límite práctico son las ~100 conexiones del cluster.
- **`counters:watch` como servicio**: hoy hay que lanzarlo a mano. Si no corre,
  los contadores se acumulan en Redis y no llegan a Postgres.
- **WebSockets sobre Pub/Sub** (F8): la base está, faltan las rutas.
