import { db } from '@/lib/db'
import { isBotProvider, PROVIDER_NAMES, type BotProvider } from '@/lib/bot-message'
import { periodStart, summarizeCalls, type CallPeriod, type CallSummary } from '@/lib/call-score'
import { audienceByCommunity } from '@/lib/bot-audience'

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

/**
 * Ranking público de comunidades ("Clanes"): los grupos de Telegram, canales y
 * servidores de Discord que ya usan el bot, con sus calls y sus miembros.
 *
 * La idea es que nadie tenga que crear un clan dentro de Cabal: la comunidad
 * que ya existe en Telegram o Discord es el clan, y desde aquí cualquiera
 * puede entrar con su enlace público.
 *
 * Se ordena por Cabal Score de sus calls; con `period` se mide solo lo del
 * periodo elegido, igual que Top Callers.
 */
export type CommunityBoardRow = {
  key: CommunityKey
  label: string
  provider: BotProvider
  /** Chats de esa comunidad con el bot (Discord puede tener varios canales). */
  chats: number
  members: number | null
  online: number | null
  /** Foto del grupo, canal o servidor. */
  image: string | null
  /** Enlace público para unirse, si la comunidad tiene uno. */
  link: string | null
  callers: number
  summary: CallSummary
  /** Los que mejor lo hacen en esa comunidad (para la tarjeta del clan). */
  topCallers: { handle: string; name: string; avatar: string; score: number; bestMultiple: number | null }[]
  lastCallAt: string | null
}

export async function communityBoard(period: CallPeriod): Promise<CommunityBoardRow[]> {
  // `active: false` = al bot lo echaron del grupo o lo bloquearon; si además
  // lo desvincularon, el ChatLink ya no existe. En los dos casos el clan
  // desaparece del ranking: un clan es una comunidad que USA el bot ahora.
  const links = await db.chatLink.findMany({
    where: { chatType: { not: 'private' }, active: true },
    select: { id: true, provider: true, chatId: true, serverId: true, chatType: true, title: true },
    orderBy: { createdAt: 'asc' },
  })
  if (links.length === 0) return []

  const since = periodStart(period)
  const calls = await db.post.findMany({
    where: {
      kind: 'call',
      chatLinkId: { in: links.map((l) => l.id) },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: { chatLinkId: true, userId: true, peakMultiple: true, currentMultiple: true, createdAt: true },
  })

  type Acc = {
    row: Omit<CommunityBoardRow, 'summary' | 'callers' | 'topCallers' | 'lastCallAt'>
    calls: { peakMultiple: number | null; currentMultiple: number | null }[]
    byUser: Map<string, { peakMultiple: number | null; currentMultiple: number | null }[]>
    lastCallAt: Date | null
  }
  const byKey = new Map<CommunityKey, Acc>()
  const keyByLink = new Map<string, CommunityKey>()
  for (const link of links) {
    const key = communityKeyOf(link)
    if (!key) continue
    keyByLink.set(link.id, key)
    const provider = link.provider as BotProvider
    const title = link.title ?? ''
    const label = (provider === 'discord' ? title.split(' · ')[0] : title) || PROVIDER_NAMES[provider]
    const found = byKey.get(key)
    if (found) found.row.chats++
    else {
      byKey.set(key, {
        row: { key, label, provider, chats: 1, members: null, online: null, image: null, link: null },
        calls: [],
        byUser: new Map(),
        lastCallAt: null,
      })
    }
  }

  for (const c of calls) {
    const key = c.chatLinkId ? keyByLink.get(c.chatLinkId) : null
    const acc = key ? byKey.get(key) : null
    if (!acc) continue
    const row = { peakMultiple: c.peakMultiple, currentMultiple: c.currentMultiple }
    acc.calls.push(row)
    const mine = acc.byUser.get(c.userId)
    if (mine) mine.push(row)
    else acc.byUser.set(c.userId, [row])
    if (!acc.lastCallAt || c.createdAt > acc.lastCallAt) acc.lastCallAt = c.createdAt
  }

  // Autores de las calls, para enseñar quién sostiene cada clan
  const userIds = [...new Set([...byKey.values()].flatMap((a) => [...a.byUser.keys()]))]
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, handle: true, name: true, avatar: true } })
    : []
  const userById = new Map(users.map((u) => [u.id, u]))

  // Miembros y enlace de cada comunidad (caché de una hora en bot-audience)
  const audience = await audienceByCommunity().catch(() => new Map())
  const rows: CommunityBoardRow[] = [...byKey.values()].map((acc) => {
    const a = audience.get(acc.row.key)
    return {
      ...acc.row,
      members: a?.members ?? null,
      online: a?.online ?? null,
      image: a?.image ?? null,
      link: a?.link ?? null,
      callers: acc.byUser.size,
      summary: summarizeCalls(acc.calls),
      topCallers: [...acc.byUser.entries()]
        .map(([userId, rows]) => ({ user: userById.get(userId), summary: summarizeCalls(rows) }))
        .filter((x) => x.user && x.summary.calls > 0)
        .sort((a, b) => b.summary.score - a.summary.score || (b.summary.bestMultiple ?? 0) - (a.summary.bestMultiple ?? 0))
        .slice(0, 3)
        .map((x) => ({
          handle: x.user!.handle,
          name: x.user!.name,
          avatar: x.user!.avatar,
          score: x.summary.score,
          bestMultiple: x.summary.bestMultiple,
        })),
      lastCallAt: acc.lastCallAt?.toISOString() ?? null,
    }
  })
  return rows.sort(
    (a, b) =>
      b.summary.score - a.summary.score ||
      b.summary.calls - a.summary.calls ||
      (b.members ?? 0) - (a.members ?? 0) ||
      a.label.localeCompare(b.label)
  )
}
