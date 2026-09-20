import { db } from '@/lib/db'
import { telegramConfig, tgCall } from '@/lib/telegram'
import { dcCall, discordConfig } from '@/lib/discord'
// Sin importar lib/bot-community: es quien llama aquí, y el ciclo entre los
// dos módulos puede dejar una de las dos funciones sin definir al arrancar.
type CommunityKey = string

/** La misma clave que lib/bot-community: el servidor en Discord, el chat en Telegram. */
function keyOf(l: { provider: string; chatId: string; serverId: string | null }): CommunityKey {
  return `${l.provider}:${l.serverId ?? l.chatId}`
}

/**
 * Cuánta gente de una comunidad tiene cuenta en Cabal ("12 de 340 en Cabal").
 *
 * Ni Telegram ni Discord dejan a un bot listar los miembros de un grupo, así
 * que se hace al revés: Cabal conoce el id de Telegram/Discord de quien ha
 * conectado su cuenta (ChatLink privado) y pregunta, uno a uno, si esa persona
 * está en el grupo (`getChatMember` / `GET /guilds/:id/members/:user`).
 *
 * Eso es una petición por persona y comunidad, así que:
 *  - el resultado se guarda en memoria y se recalcula como mucho cada 6 h;
 *  - cada pasada tiene un tope de consultas y va en segundo plano, nunca
 *    dentro de la petición web: el ranking enseña lo último que se calculó
 *    (o nada, la primera vez);
 *  - se empieza por las comunidades con más calls.
 */

/** Cada cuánto se recalcula una comunidad. */
const TTL_MS = 6 * 60 * 60_000
/** Consultas por pasada, para no acercarse a los límites de Telegram/Discord. */
const MAX_CHECKS = 200
/** Pausa entre consultas. */
const GAP_MS = 120
/** Mínimo entre pasadas. */
const MIN_GAP_MS = 5 * 60_000

/** Estados que significan "está dentro". */
const TG_IN = new Set(['creator', 'administrator', 'member', 'restricted'])

type Counted = { count: number; at: number }
const counts = new Map<CommunityKey, Counted>()
let lastRun = 0
let running = false

/** Lo calculado hasta ahora. null = todavía no se sabe de esa comunidad. */
export function cabalMembersOf(key: CommunityKey): number | null {
  return counts.get(key)?.count ?? null
}

async function isInTelegramChat(token: string, chatId: string, userId: string): Promise<boolean> {
  const member = await tgCall<{ status?: string }>(token, 'getChatMember', {
    chat_id: chatId,
    user_id: Number(userId),
  }).catch(() => null)
  return !!member?.status && TG_IN.has(member.status)
}

async function isInDiscordGuild(token: string, guildId: string, userId: string): Promise<boolean> {
  const member = await dcCall<{ user?: unknown }>(token, 'GET', `/guilds/${guildId}/members/${userId}`).catch(() => null)
  return !!member?.user
}

/**
 * Recalcula las comunidades que toquen, en segundo plano. Se llama desde el
 * ranking: quien mira no espera nada.
 */
export function kickCabalMembersSync() {
  const now = Date.now()
  if (running || now - lastRun < MIN_GAP_MS) return
  lastRun = now
  running = true
  void refresh()
    .catch((e) => console.error('[community-members]', (e as Error).message))
    .finally(() => {
      running = false
    })
}

async function refresh(): Promise<void> {
  const [links, linked, verified] = await Promise.all([
    db.chatLink.findMany({
      where: { chatType: { not: 'private' }, active: true },
      select: { id: true, provider: true, chatId: true, serverId: true, chatType: true },
    }),
    // Cuentas de Cabal con su Telegram/Discord conectado al bot
    db.chatLink.findMany({
      where: { chatType: 'private', active: true, externalUserId: { not: null } },
      select: { provider: true, externalUserId: true, userId: true },
    }),
    // Cuentas que verificaron Discord por OAuth desde el perfil. Cuentan igual:
    // lo único que hace falta para preguntarle al bot si están en un servidor
    // es el id de Discord, y da igual cómo se haya obtenido.
    db.user.findMany({
      where: { discordId: { not: null } },
      select: { id: true, discordId: true },
    }),
  ])

  // Una misma persona puede tener las dos cosas (bot y OAuth); se queda una.
  const accounts = [
    ...linked,
    ...verified.map((u) => ({
      provider: 'discord',
      externalUserId: u.discordId,
      userId: u.id,
    })),
  ]
  if (links.length === 0 || accounts.length === 0) return

  const tg = await telegramConfig()
  const dc = await discordConfig()

  // Comunidades pendientes, las que más calls tienen primero
  const callCounts = await db.post.groupBy({
    by: ['chatLinkId'],
    where: { kind: 'call', chatLinkId: { in: links.map((l) => l.id) } },
    _count: { _all: true },
  })
  const callsByLink = new Map(callCounts.map((c) => [c.chatLinkId, c._count._all]))

  type Target = { key: CommunityKey; provider: string; id: string; calls: number }
  const targets = new Map<CommunityKey, Target>()
  for (const l of links) {
    const key = keyOf(l)
    const calls = callsByLink.get(l.id) ?? 0
    const found = targets.get(key)
    if (found) found.calls += calls
    // En Discord se pregunta por el servidor; en Telegram, por el chat
    else targets.set(key, { key, provider: l.provider, id: l.serverId ?? l.chatId, calls })
  }

  const now = Date.now()
  const pending = [...targets.values()]
    .filter((t) => now - (counts.get(t.key)?.at ?? 0) >= TTL_MS)
    .filter((t) => (t.provider === 'telegram' ? !!tg : !!dc))
    .sort((a, b) => b.calls - a.calls)

  let checks = 0
  for (const t of pending) {
    const people = accounts.filter((a) => a.provider === t.provider)
    if (people.length === 0) {
      counts.set(t.key, { count: 0, at: Date.now() })
      continue
    }
    // Si no caben todas las consultas de esta comunidad, se deja para la
    // siguiente pasada: medio recuento engañaría más que no enseñar nada
    if (checks + people.length > MAX_CHECKS) break

    const seen = new Set<string>()
    let count = 0
    for (const person of people) {
      if (seen.has(person.userId)) continue
      seen.add(person.userId)
      checks++
      const inside =
        t.provider === 'telegram'
          ? await isInTelegramChat(tg!.token, t.id, person.externalUserId!)
          : await isInDiscordGuild(dc!.token, t.id, person.externalUserId!)
      if (inside) count++
      await new Promise((r) => setTimeout(r, GAP_MS))
    }
    counts.set(t.key, { count, at: Date.now() })
  }
}
