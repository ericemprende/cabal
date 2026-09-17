import { db } from '@/lib/db'
import { isBotProvider, PROVIDER_NAMES, type BotProvider } from '@/lib/bot-message'

/**
 * Una "comunidad" es el grupo o servidor del que salen las calls, y es la
 * unidad con la que se filtra el leaderboard.
 *
 * No coincide con un chat: en Discord un servidor puede tener varios canales
 * con el bot y todos son la misma comunidad, así que la clave es el servidor
 * (ChatLink.serverId). En Telegram cada grupo o canal es su propia comunidad,
 * así que la clave es el chat. Los privados no son comunidad de nadie.
 *
 * La clave viaja en la URL del leaderboard ("telegram:-1001234"), así que se
 * valida siempre antes de usarla contra la base de datos.
 */

export type CommunityKey = string

export type Community = {
  key: CommunityKey
  /** Nombre que ve el usuario ("Mi servidor", "Cabal ES"). */
  label: string
  provider: BotProvider
  /** Cuántos chats de esa comunidad tienen el bot. */
  chats: number
  calls: number
}

type ChatLinkLike = { provider: string; chatId: string; serverId: string | null; chatType: string }

/** Los privados no forman comunidad: una call desde tu DM no es de ningún grupo. */
export function isCommunityChat(link: ChatLinkLike): boolean {
  return link.chatType !== 'private'
}

export function communityKeyOf(link: ChatLinkLike): CommunityKey | null {
  if (!isCommunityChat(link) || !isBotProvider(link.provider)) return null
  return `${link.provider}:${link.serverId ?? link.chatId}`
}

export function parseCommunityKey(key: string | null | undefined): { provider: BotProvider; id: string } | null {
  if (!key) return null
  const sep = key.indexOf(':')
  if (sep < 1) return null
  const provider = key.slice(0, sep)
  const id = key.slice(sep + 1)
  if (!isBotProvider(provider) || !id || id.length > 100) return null
  return { provider, id }
}

/**
 * Los chats de una comunidad. El leaderboard filtra por estos ids, así que si
 * la clave no existe devuelve lista vacía y el ranking sale vacío (nunca el
 * global por error).
 */
export async function chatLinkIdsOf(key: CommunityKey): Promise<string[]> {
  const parsed = parseCommunityKey(key)
  if (!parsed) return []
  const links = await db.chatLink.findMany({
    where: {
      provider: parsed.provider,
      chatType: { not: 'private' },
      OR: [{ serverId: parsed.id }, { serverId: null, chatId: parsed.id }],
    },
    select: { id: true },
  })
  return links.map((l) => l.id)
}

/** Nombre de la comunidad: el del servidor en Discord, el del chat en Telegram. */
export async function communityLabel(key: CommunityKey): Promise<string | null> {
  const parsed = parseCommunityKey(key)
  if (!parsed) return null
  const link = await db.chatLink.findFirst({
    where: {
      provider: parsed.provider,
      chatType: { not: 'private' },
      OR: [{ serverId: parsed.id }, { serverId: null, chatId: parsed.id }],
    },
    orderBy: { createdAt: 'asc' },
    select: { title: true },
  })
  if (!link) return null
  // El título de Discord viene como "Servidor · #canal": la comunidad es el servidor
  const title = link.title ?? ''
  return (parsed.provider === 'discord' ? title.split(' · ')[0] : title) || PROVIDER_NAMES[parsed.provider]
}

/**
 * Comunidades que han dado alguna call, para el desplegable del leaderboard.
 * Se ordenan por número de calls: las activas primero.
 */
export async function listCommunities(): Promise<Community[]> {
  const links = await db.chatLink.findMany({
    where: { chatType: { not: 'private' } },
    select: { id: true, provider: true, chatId: true, serverId: true, chatType: true, title: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  if (links.length === 0) return []

  const counts = await db.post.groupBy({
    by: ['chatLinkId'],
    where: { kind: 'call', chatLinkId: { in: links.map((l) => l.id) } },
    _count: { _all: true },
  })
  const callsByLink = new Map(counts.map((c) => [c.chatLinkId, c._count._all]))

  const byKey = new Map<CommunityKey, Community>()
  for (const link of links) {
    const key = communityKeyOf(link)
    if (!key) continue
    const provider = link.provider as BotProvider
    const title = link.title ?? ''
    const label = (provider === 'discord' ? title.split(' · ')[0] : title) || PROVIDER_NAMES[provider]
    const found = byKey.get(key)
    const calls = callsByLink.get(link.id) ?? 0
    if (found) {
      found.chats++
      found.calls += calls
    } else {
      byKey.set(key, { key, label, provider, chats: 1, calls })
    }
  }
  return [...byKey.values()].filter((c) => c.calls > 0).sort((a, b) => b.calls - a.calls || a.label.localeCompare(b.label))
}
