import { db } from '@/lib/db'
import { DEFAULT_CHARACTERS, DEFAULT_CHARACTER_ID, type GuideCharacter } from '@/lib/guide-characters'

/**
 * Lo configurable del asistente de Radio Cabal. Los personajes y sus textos
 * viven en código (lib/guide-characters.ts); aquí solo se guarda lo que el
 * panel de admin puede cambiar: la foto de cada uno, si está en servicio,
 * quién atiende por defecto y si el asistente aparece o no.
 *
 * Todo en `Setting`, con prefijo `guide_`, para no tocar el esquema.
 */

const K = {
  enabled: 'guide_enabled',
  welcome: 'guide_welcome',
  defaultId: 'guide_default_character',
  /** Un JSON con { [id]: { image, enabled } }. */
  overrides: 'guide_character_overrides',
} as const

export interface GuideConfig {
  /** El asistente aparece en la app. */
  enabled: boolean
  /** Se abre solo la primera vez que alguien entra. */
  welcome: boolean
  defaultCharacterId: string
  characters: GuideCharacter[]
}

type Override = { image?: string; enabled?: boolean }

function parseOverrides(raw: string | undefined): Record<string, Override> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Override>) : {}
  } catch {
    return {}
  }
}

/** Solo rutas internas o https: una imagen de otro sitio no entra. */
export function normalizeCharacterImage(raw: string): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  if (v.startsWith('/')) return v.slice(0, 500)
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? u.toString().slice(0, 500) : ''
  } catch {
    return ''
  }
}

export async function guideConfig(): Promise<GuideConfig> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'guide_' } } })
  const v = (key: string) => rows.find((r) => r.key === key)?.value
  const overrides = parseOverrides(v(K.overrides))

  const characters = DEFAULT_CHARACTERS.map((c) => {
    const o = overrides[c.id]
    return {
      ...c,
      image: normalizeCharacterImage(o?.image ?? c.image),
      enabled: typeof o?.enabled === 'boolean' ? o.enabled : c.enabled,
    }
  })

  // Si quien atendía queda fuera de servicio, atiende el primero que siga en pie.
  const wanted = v(K.defaultId) ?? DEFAULT_CHARACTER_ID
  const fallback = characters.find((c) => c.enabled)?.id ?? DEFAULT_CHARACTER_ID
  const defaultCharacterId = characters.some((c) => c.id === wanted && c.enabled) ? wanted : fallback

  return {
    enabled: v(K.enabled) !== '0',
    welcome: v(K.welcome) !== '0',
    defaultCharacterId,
    characters,
  }
}

export interface GuideConfigPatch {
  enabled?: boolean
  welcome?: boolean
  defaultCharacterId?: string
  /** Solo los que cambian; el resto se deja como está. */
  characters?: { id: string; image?: string; enabled?: boolean }[]
}

export async function saveGuideConfig(patch: GuideConfigPatch): Promise<GuideConfig> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'guide_' } } })
  const current = parseOverrides(rows.find((r) => r.key === K.overrides)?.value)
  const writes: { key: string; value: string }[] = []
  const put = (key: string, value: string) => writes.push({ key, value })

  if (typeof patch.enabled === 'boolean') put(K.enabled, patch.enabled ? '1' : '0')
  if (typeof patch.welcome === 'boolean') put(K.welcome, patch.welcome ? '1' : '0')
  if (typeof patch.defaultCharacterId === 'string') {
    const known = DEFAULT_CHARACTERS.some((c) => c.id === patch.defaultCharacterId)
    if (known) put(K.defaultId, patch.defaultCharacterId)
  }

  if (Array.isArray(patch.characters)) {
    for (const c of patch.characters) {
      if (!DEFAULT_CHARACTERS.some((d) => d.id === c.id)) continue
      const next: Override = { ...current[c.id] }
      if (typeof c.image === 'string') next.image = normalizeCharacterImage(c.image)
      if (typeof c.enabled === 'boolean') next.enabled = c.enabled
      current[c.id] = next
    }
    put(K.overrides, JSON.stringify(current))
  }

  if (writes.length > 0) {
    await db.$transaction(
      writes.map((w) => db.setting.upsert({ where: { key: w.key }, update: { value: w.value }, create: w }))
    )
  }
  return guideConfig()
}
