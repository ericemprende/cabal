import { db } from '@/lib/db'
import { OFFICIAL_ACCOUNT_KEY, SYSTEM_HANDLES } from '@/lib/chat-announce'

/**
 * La cuenta oficial de Cabal: firma los avisos del chat y los proyectos que el
 * admin publica avalados por Cabal.
 *
 * Al principio se creaba sola (@cabal, sin contraseña). Aquí el admin elige
 * una cuenta de verdad, con la que puede entrar y poner foto y bio. Si la
 * anterior era la creada sola, se fusiona en la nueva: todo lo suyo (launches,
 * mensajes del chat…) pasa a la elegida y la vieja se borra.
 */

export type OfficialAccountDTO = {
  user: { id: string; handle: string; name: string; avatar: string } | null
}

export async function getOfficialAccount(): Promise<OfficialAccountDTO> {
  const saved = await db.setting.findUnique({ where: { key: OFFICIAL_ACCOUNT_KEY } })
  const user = saved
    ? await db.user.findUnique({
        where: { id: saved.value },
        select: { id: true, handle: true, name: true, avatar: true },
      })
    : null
  return { user }
}

/** La creó el sistema y nadie puede entrar en ella: se puede fusionar y borrar sin perder a nadie. */
function isAutoCreated(u: {
  handle: string
  passwordHash: string | null
  email: string | null
  googleEmail: string | null
  xHandle: string | null
  discordId: string | null
  wallet: string | null
}) {
  return (
    SYSTEM_HANDLES.includes(u.handle) &&
    !u.passwordHash &&
    !u.email &&
    !u.googleEmail &&
    !u.xHandle &&
    !u.discordId &&
    !u.wallet
  )
}

/** Columnas de cualquier tabla que apuntan a User.id (sacadas del propio Postgres). */
async function userForeignKeys(): Promise<{ table: string; column: string }[]> {
  return db.$queryRaw<{ table: string; column: string }[]>`
    SELECT kcu.table_name AS "table", kcu.column_name AS "column"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = current_schema()
      AND ccu.table_name = 'User'
      AND ccu.column_name = 'id'
  `
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`

export async function setOfficialAccount(handle: string): Promise<OfficialAccountDTO & { merged: string | null }> {
  const clean = handle.trim().replace(/^@/, '').toLowerCase()
  const target = await db.user.findFirst({ where: { handle: { equals: clean, mode: 'insensitive' } } })
  if (!target) throw new Error(`No existe ningún usuario @${clean}`)

  const saved = await db.setting.findUnique({ where: { key: OFFICIAL_ACCOUNT_KEY } })
  const previous =
    saved && saved.value !== target.id ? await db.user.findUnique({ where: { id: saved.value } }) : null
  const merge = previous && isAutoCreated(previous) ? previous : null
  const fks = merge ? await userForeignKeys() : []

  await db.$transaction(
    async (tx) => {
      if (merge) {
        for (const { table, column } of fks) {
          // Si la vieja y la nueva tienen la misma fila (los dos dieron like al
          // mismo mensaje, siguen a la misma persona…) el UPDATE choca con un
          // unique: esa fila ya la tiene la nueva y la de la vieja sobra.
          await tx.$executeRawUnsafe('SAVEPOINT merge_fk')
          try {
            await tx.$executeRawUnsafe(
              `UPDATE ${ident(table)} SET ${ident(column)} = $1 WHERE ${ident(column)} = $2`,
              target.id,
              merge.id
            )
            await tx.$executeRawUnsafe('RELEASE SAVEPOINT merge_fk')
          } catch {
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT merge_fk')
            await tx.$executeRawUnsafe(`DELETE FROM ${ident(table)} WHERE ${ident(column)} = $1`, merge.id)
          }
        }
        await tx.user.delete({ where: { id: merge.id } })
      }
      await tx.user.update({ where: { id: target.id }, data: { verified: true, verifiedVia: 'admin' } })
      await tx.setting.upsert({
        where: { key: OFFICIAL_ACCOUNT_KEY },
        update: { value: target.id },
        create: { key: OFFICIAL_ACCOUNT_KEY, value: target.id },
      })
    },
    { timeout: 30_000 }
  )

  return { ...(await getOfficialAccount()), merged: merge ? merge.handle : null }
}
