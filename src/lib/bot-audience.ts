import { db } from '@/lib/db'
import { telegramConfig, tgCall } from '@/lib/telegram'
import { dcCall, discordConfig } from '@/lib/discord'
import type { BotProvider } from '@/lib/bot-message'
import { communityKeyOf } from '@/lib/bot-community'
import type { AdminChatDTO, AdminChatsDTO } from '@/lib/notify-types'

/**
 * Alcance de los bots para el panel admin: cuántos miembros tiene cada grupo,
 * canal o servidor conectado.
 *
 * Solo se piden datos agregados y públicos para el propio bot (número de
 * miembros, nombre, enlace público). Nunca la lista de miembros: ni hace falta
 * ni lo permitirían las políticas de Telegram/Discord sin un motivo.
 *
 * Las respuestas se guardan una hora en memoria: el panel se abre a menudo y
 * no hace falta preguntar a Telegram/Discord cada vez.
 */

type Audience = {
  members: number | null
  online: number | null
  link: string | null
  /** Foto del grupo/servidor: URL del CDN de Discord, o /api/bot-avatar/<chat> en Telegram. */
  image: string | null
  error: string | null
}

const TTL_MS = 60 * 60_000
const cache = new Map<string, { at: number; value: Audience }>()

async function cached(key: string, fresh: boolean, load: () => Promise<Audience>): Promise<Audience> {
  const hit = cache.get(key)
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = await load().catch((e: Error) => ({ members: null, online: null, link: null, image: null, error: e.message }))
  cache.set(key, { at: Date.now(), value })
  return value
}

async function telegramAudience(token: string, chatId: string): Promise<Audience> {
  const [chat, members] = await Promise.all([
    tgCall<{ username?: string; invite_link?: string; photo?: { small_file_id?: string } }>(token, 'getChat', { chat_id: chatId }),
    tgCall<number>(token, 'getChatMemberCount', { chat_id: chatId }),
  ])
  return {
    // El propio bot cuenta como miembro
    members: Math.max(0, members - 1),
    online: null,
    link: chat.username ? `https://t.me/${chat.username}` : chat.invite_link ?? null,
    // La foto se sirve desde Cabal: en Telegram solo se descarga con el token del bot
    image: chat.photo ? `/api/bot-avatar/${encodeURIComponent(chatId)}` : null,
    error: null,
  }
}

/**
 * Invitación permanente al servidor, creada por el bot en el canal donde está.
 *
 * Es lo que le da botón «Unirme» a los servidores sin URL personalizada, que
 * son casi todos (la personalizada pide nivel 3 de boosts). Solo se pide
 * cuando hace falta, no en cada consulta de alcance, y tiene su propia caché:
 * así no se toca un servidor que ya tiene enlace.
 *
 * `unique: false` es lo importante: Discord devuelve la invitación que ya
 * exista con estas mismas condiciones en vez de crear una nueva cada vez.
 * Necesita el permiso CREATE_INSTANT_INVITE; si el servidor añadió el bot
 * antes de que se pidiera, responde 403 y aquí null.
 */
const inviteCache = new Map<string, { at: number; value: string | null }>()

async function discordInvite(token: string, channelId: string): Promise<string | null> {
  const hit = inviteCache.get(channelId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  let value: string | null = null
  try {
    const invite = await dcCall<{ code?: string }>(token, 'POST', `/channels/${channelId}/invites`, {
      max_age: 0,
      max_uses: 0,
      temporary: false,
      unique: false,
    })
    value = invite.code ? `https://discord.gg/${invite.code}` : null
  } catch {
    // Sin permiso para invitar: el clan se queda sin botón salvo que su dueño
    // pegue el enlace a mano. No es motivo para perder miembros y foto.
    value = null
  }
  inviteCache.set(channelId, { at: Date.now(), value })
  return value
}

async function discordAudience(token: string, serverId: string): Promise<Audience> {
  const guild = await dcCall<{
    approximate_member_count?: number
    approximate_presence_count?: number
    vanity_url_code?: string | null
    icon?: string | null
  }>(token, 'GET', `/guilds/${serverId}?with_counts=true`)
  return {
    members: guild.approximate_member_count ?? null,
    online: guild.approximate_presence_count ?? null,
    // La URL personalizada es la buena: no caduca ni depende de un canal. Si el
    // servidor no la tiene, quien llame se crea una invitación (discordInvite)
    link: guild.vanity_url_code ? `https://discord.gg/${guild.vanity_url_code}` : null,
    // El icono del servidor ya es público (los .a_ son animados: se piden en gif)
    image: guild.icon
      ? `https://cdn.discordapp.com/icons/${serverId}/${guild.icon}.${guild.icon.startsWith('a_') ? 'gif' : 'png'}?size=160`
      : null,
    error: null,
  }
}

/** Reparte las consultas de a pocas para no chocar con los límites de las APIs. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    })
  )
  return out
}

export async function listBotChats(provider: BotProvider, fresh = false): Promise<AdminChatsDTO> {
  const [links, calls] = await Promise.all([
    db.chatLink.findMany({
      where: { provider },
      include: { user: { select: { handle: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.post.groupBy({ by: ['chatLinkId'], where: { kind: 'call', chatLink: { provider } }, _count: { _all: true } }),
  ])
  const callsByLink = new Map(calls.map((c) => [c.chatLinkId, c._count._all]))

  const tg = provider === 'telegram' ? await telegramConfig() : null
  const dc = provider === 'discord' ? await discordConfig() : null

  const chats = await mapLimited(links, 4, async (l): Promise<AdminChatDTO> => {
    let audience: Audience = { members: null, online: null, link: null, image: null, error: null }
    // Los privados son una persona: no hay nada que contar
    if (l.active && l.chatType !== 'private') {
      if (tg) audience = await cached(`tg:${l.chatId}`, fresh, () => telegramAudience(tg.token, l.chatId))
      else if (dc && l.serverId)
        audience = await cached(`dc:${l.serverId}`, fresh, () => discordAudience(dc.token, l.serverId!))
    }
    return {
      id: l.id,
      chatType: l.chatType,
      title: l.title,
      serverId: l.serverId,
      active: l.active,
      lastError: l.lastError,
      createdAt: l.createdAt.toISOString(),
      owner: { handle: l.user.handle, name: l.user.name },
      calls: callsByLink.get(l.id) ?? 0,
      members: audience.members,
      online: audience.online,
      link:
        // El que pegó el dueño manda: lo eligió él
        l.inviteUrl ??
        audience.link ??
        // En Discord el enlace al canal solo abre si ya estás en el servidor, pero sirve para revisarlo
        (provider === 'discord' && l.serverId && l.chatType !== 'private'
          ? `https://discord.com/channels/${l.serverId}/${l.chatId}`
          : null),
      audienceError: audience.error,
    }
  })

  // Alcance: cada privado es una persona; en Discord un servidor cuenta una vez
  // aunque tenga varios canales conectados
  const active = chats.filter((c) => c.active)
  const seenServers = new Set<string>()
  let reach = 0
  for (const c of active) {
    if (c.chatType === 'private') {
      reach++
      continue
    }
    if (c.members == null) continue
    if (provider === 'discord' && c.serverId) {
      if (seenServers.has(c.serverId)) continue
      seenServers.add(c.serverId)
    }
    reach += c.members
  }

  return { provider, reach, unknown: active.filter((c) => c.chatType !== 'private' && c.members == null).length, chats }
}

/**
 * Miembros y enlace de cada comunidad (grupo, canal o servidor con el bot),
 * para el ranking público de comunidades. Usa la misma caché de una hora que
 * el panel admin, así que abrir el ranking no dispara consultas nuevas a
 * Telegram/Discord salvo una vez por hora y comunidad.
 */
export async function audienceByCommunity(): Promise<
  Map<string, { members: number | null; online: number | null; link: string | null; image: string | null }>
> {
  const links = await db.chatLink.findMany({
    where: { chatType: { not: 'private' }, active: true },
    select: { provider: true, chatId: true, serverId: true, chatType: true, inviteUrl: true },
    orderBy: { createdAt: 'asc' },
  })
  const out = new Map<string, { members: number | null; online: number | null; link: string | null; image: string | null }>()
  if (links.length === 0) return out

  const tg = links.some((l) => l.provider === 'telegram') ? await telegramConfig() : null
  const dc = links.some((l) => l.provider === 'discord') ? await discordConfig() : null

  // Una consulta por comunidad, no por chat: un servidor de Discord con tres
  // canales conectados es un solo clan. El chat más antiguo es el que
  // representa a la comunidad, y el enlace pegado a mano en cualquiera de sus
  // chats vale para todos.
  const byKey = new Map<string, { link: (typeof links)[number]; inviteUrl: string | null }>()
  for (const link of links) {
    const key = communityKeyOf(link)
    if (!key) continue
    const found = byKey.get(key)
    if (found) found.inviteUrl ??= link.inviteUrl
    else byKey.set(key, { link, inviteUrl: link.inviteUrl })
  }

  await mapLimited([...byKey.entries()], 4, async ([key, { link: l, inviteUrl }]) => {
    let audience: Audience = { members: null, online: null, link: null, image: null, error: null }
    if (l.provider === 'telegram' && tg) {
      audience = await cached(`tg:${l.chatId}`, false, () => telegramAudience(tg.token, l.chatId))
    } else if (l.provider === 'discord' && dc && l.serverId) {
      audience = await cached(`dc:${l.serverId}`, false, () => discordAudience(dc.token, l.serverId!))
      // Sin URL personalizada y sin enlace del dueño: que el bot se cree una
      if (!inviteUrl && !audience.link) audience = { ...audience, link: await discordInvite(dc.token, l.chatId) }
    }
    out.set(key, {
      members: audience.members,
      online: audience.online,
      // El que pegó el dueño manda sobre el que saca el bot
      link: inviteUrl ?? audience.link,
      image: audience.image,
    })
  })
  return out
}
