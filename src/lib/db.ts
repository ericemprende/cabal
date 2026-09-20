import { PrismaClient } from '@prisma/client'
import { trackDb } from '@/lib/metrics'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Cada consulta se apunta en lib/metrics (cuántas y cuánto tardan), que es lo
 * que alimenta "Salud del servidor" en el panel de admin. Es solo un contador
 * en memoria/Redis: no guarda ni la consulta ni sus datos.
 */
function createClient(): PrismaClient {
  const client = new PrismaClient({ log: ['error'] })
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        const started = Date.now()
        try {
          return await query(args)
        } finally {
          trackDb(Date.now() - started)
        }
      },
    },
  }) as unknown as PrismaClient
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
