import { db } from '@/lib/db'

/**
 * Go High Level: cada cuenta con correo entra en el CRM como contacto con la
 * etiqueta "Cabal". El flujo de seguimiento se monta en GHL con el disparador
 * "Contact Tag Added = Cabal"; así se edita desde allí sin tocar la app.
 *
 * Variables de entorno:
 *  - GHL_PRIVATE_TOKEN   Private Integration Token (scopes: contacts.write y,
 *                        si se usa GHL_WORKFLOW_ID, workflows)
 *  - GHL_LOCATION_ID     subcuenta (location) donde van los contactos
 *  - GHL_TAG             opcional, "Cabal" por defecto
 *  - GHL_WORKFLOW_ID     opcional: además de etiquetar, mete al contacto en ese
 *                        workflow. No lo uses si el workflow ya se dispara por la
 *                        etiqueta, o el contacto entrará dos veces.
 */

const DEFAULT_API = 'https://services.leadconnectorhq.com'

export function ghlConfig() {
  const token = process.env.GHL_PRIVATE_TOKEN?.trim()
  const locationId = process.env.GHL_LOCATION_ID?.trim()
  if (!token || !locationId) return null
  return {
    token,
    locationId,
    tag: process.env.GHL_TAG?.trim() || 'Cabal',
    workflowId: process.env.GHL_WORKFLOW_ID?.trim() || null,
    // La mayoría de endpoints de contactos siguen en la versión 2021-07-28
    version: process.env.GHL_API_VERSION?.trim() || '2021-07-28',
    api: (process.env.GHL_API_URL?.trim() || DEFAULT_API).replace(/\/+$/, ''),
  }
}

type GhlConfig = NonNullable<ReturnType<typeof ghlConfig>>

async function ghlPost<T>(cfg: GhlConfig, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${cfg.api}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Version: cfg.version,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json().catch(() => ({}))) as T & { message?: string | string[] }
  if (!res.ok) {
    const msg = Array.isArray(json.message) ? json.message.join('; ') : json.message
    throw new Error(`GHL ${path.split('/').slice(0, 3).join('/')} ${res.status}: ${msg ?? 'error'}`)
  }
  return json
}

/**
 * Crea o actualiza el contacto y le pone la etiqueta. Idempotente: GHL busca el
 * contacto por correo, y añadir una etiqueta que ya tiene no hace nada.
 *
 * El upsert va SIN etiquetas porque en ese endpoint sustituyen a todas las que
 * tenga el contacto (borraría las que le haya puesto el equipo en el CRM); la
 * etiqueta se añade después con el endpoint que suma.
 */
export async function syncUserToGhl(userId: string): Promise<'synced' | 'skipped'> {
  const cfg = ghlConfig()
  if (!cfg) return 'skipped'
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, handle: true },
  })
  if (!user?.email) return 'skipped'

  try {
    const [firstName, ...rest] = user.name.trim().split(/\s+/)
    const up = await ghlPost<{ contact?: { id?: string } }>(cfg, '/contacts/upsert', {
      locationId: cfg.locationId,
      email: user.email,
      firstName: firstName || user.handle,
      lastName: rest.join(' ') || undefined,
      source: 'cabal.army',
    })
    const contactId = up.contact?.id
    if (!contactId) throw new Error('GHL no devolvió el id del contacto')

    await ghlPost(cfg, `/contacts/${encodeURIComponent(contactId)}/tags`, { tags: [cfg.tag] })
    if (cfg.workflowId) {
      await ghlPost(
        cfg,
        `/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(cfg.workflowId)}`,
        {}
      )
    }

    await db.user.update({
      where: { id: userId },
      data: { ghlContactId: contactId, ghlSyncedAt: new Date(), ghlError: null },
    })
    return 'synced'
  } catch (e) {
    await db.user
      .update({ where: { id: userId }, data: { ghlError: (e as Error).message.slice(0, 300) } })
      .catch(() => {})
    throw e
  }
}

/**
 * Lanza la sincronización sin esperarla: el alta en el CRM nunca debe frenar ni
 * tumbar un registro. Si falla, queda el error en la cuenta y el panel de admin
 * permite reintentar las pendientes.
 */
export function queueGhlSync(userId: string): void {
  if (!ghlConfig()) return
  void syncUserToGhl(userId).catch((e) => console.error('[ghl]', (e as Error).message))
}

/** Sincroniza en serie las cuentas con correo que aún no están en el CRM. */
export async function syncPendingToGhl(limit = 100): Promise<{ synced: number; failed: number; remaining: number }> {
  const where = { email: { not: null }, ghlSyncedAt: null }
  // Primero las que nunca se intentaron: una cuenta que GHL rechaza siempre no
  // debe bloquear a las demás en cada pasada
  const pending = await db.user.findMany({
    where,
    select: { id: true },
    orderBy: [{ ghlError: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    take: limit,
  })
  let synced = 0
  let failed = 0
  // En serie a propósito: GHL limita a ~100 peticiones cada 10 s por subcuenta
  for (const u of pending) {
    try {
      if ((await syncUserToGhl(u.id)) === 'synced') synced++
    } catch {
      failed++
    }
  }
  const remaining = await db.user.count({ where })
  return { synced, failed, remaining }
}
