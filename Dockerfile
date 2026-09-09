# syntax=docker/dockerfile:1
# ---------------------------------------------------------------
# Cabal - imagen de producción (Next 16 standalone + Bun + Prisma)
# Pensada para Dokploy: build desde este Dockerfile, puerto 3000.
# ---------------------------------------------------------------

# ---------- 1. Dependencias ----------
FROM oven/bun:1-debian AS deps
WORKDIR /app
# openssl: los engines de Prisma lo enlazan en runtime y en `prisma generate`.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---------- 2. Build ----------
FROM oven/bun:1-debian AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables NEXT_PUBLIC_* se inlinean en el bundle: deben existir en build time.
ARG NEXT_PUBLIC_SITE_URL=https://cabal.army
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# El cliente de Prisma se genera contra el schema, no contra la BD: no hace
# falta que Postgres esté vivo durante el build.
RUN bunx prisma generate
RUN bun run build

# ---------- 3. Runtime ----------
FROM oven/bun:1-debian AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# `next build` (script del proyecto) ya copió static/ y public/ dentro de standalone.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/prisma ./prisma
# prisma CLI + engines para poder ejecutar `migrate deploy` al arrancar.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "server.js"]

# ---------- 4. Worker de contadores ----------
# `scripts/counters-flush.mjs` importa TypeScript de src/ y lo ejecuta Bun
# directamente, así que necesita el árbol de fuentes completo: parte de
# `builder` en vez del standalone.
FROM builder AS counters
WORKDIR /app
ENV NODE_ENV=production
CMD ["bun", "scripts/counters-flush.mjs", "--watch"]
