// Integración con Go High Level (GHL): sincroniza usuarios de Cabal como
// contactos con la etiqueta "cabal". Usa un Private Integration Token (PIT),
// no OAuth — ver https://services.leadconnectorhq.com.
//
// Requiere GHL_LOCATION_ID y GHL_PIT en el entorno. Si faltan, todas las
// llamadas son no-ops (best-effort): la app sigue funcionando sin GHL.

const GHL_API_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'
const CABAL_TAG = 'cabal'

function ghlConfigured() {
  return Boolean(process.env.GHL_LOCATION_ID && process.env.GHL_PIT)
}

async function ghlFetch(path: string, init: RequestInit) {
  const res = await fetch(`${GHL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GHL_PIT}`,
      Version: GHL_VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GHL ${init.method ?? 'GET'} ${path} -> ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json().catch(() => ({}))
}

/**
 * Crea o actualiza (upsert por email) el contacto en GHL y le pone la
 * etiqueta "cabal". Es best-effort: nunca lanza — un fallo de GHL no debe
 * romper el registro/login de un usuario en Cabal. Los errores se registran
 * en consola para poder auditarlos.
 */
export async function syncUserToGhl(user: { email: string; name?: string | null; handle: string }) {
  if (!ghlConfigured()) return
  try {
    const [firstName, ...rest] = (user.name || user.handle).trim().split(/\s+/)
    await ghlFetch('/contacts/upsert', {
      method: 'POST',
      body: JSON.stringify({
        locationId: process.env.GHL_LOCATION_ID,
        email: user.email,
        firstName: firstName || user.handle,
        lastName: rest.join(' ') || undefined,
        tags: [CABAL_TAG],
        source: 'cabal.army',
      }),
    })
  } catch (e) {
    console.error('[ghl] no se pudo sincronizar el contacto', user.email, e)
  }
}
