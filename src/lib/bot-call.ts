import { db } from '@/lib/db'
import { awardPoints } from '@/lib/api-helpers'
import { invalidate } from '@/lib/cache'
import { rateLimit } from '@/lib/rate-limit'
import { networkMeta } from '@/lib/cabal'
import { siteUrl } from '@/lib/waitlist'
import { fetchCallSnapshot, isValidContract } from '@/lib/chain-stats'
import { liveCallResult } from '@/lib/call-results'
import { parseAffiliateLinks, platformLinkFor } from '@/lib/affiliate'
import { callerStatsBlock, callerStatsButtons, userLink } from '@/lib/notifications'
import { chatLinkIdsOf, communityKeyOf } from '@/lib/bot-community'
import { esc, type BotButton, type BotMessage, type BotProvider } from '@/lib/bot-message'
import { t, type Lang } from '@/lib/bot-i18n'
import { fmtMultiple } from '@/lib/call-score'

/**
 * Contratos que llegan desde Telegram o Discord: la ficha del token y, cuando
 * toca, la call publicada en Cabal.
 *
 * Dos puertas, una sola lógica:
 *   - `command`: alguien escribió /call <CA>. Si algo falla, se le dice.
 *   - `pasted`:  alguien pegó un CA suelto en el chat. La ficha se enseña a
 *                todos, pero un CA que no es un token no genera ruido: se
 *                calla. Requiere que el bot pueda leer los mensajes del grupo
 *                (en Telegram, /setprivacy → Disable en BotFather).
 *
 * La call que se crea es la misma que la de la web (Post kind="call"), con su
 * precio y MC de entrada, así que cuenta para el Cabal Score, el ranking de
 * Top Callers y el perfil de quien la dio.
 *
 * Regla de "primera call": dentro de una comunidad, un token se llama una vez.
 * Si ya lo llamó alguien allí, se enseña la ficha con quién fue y a qué MC,
 * pero no se crea otra call — si no, el ranking se llenaría de repeticiones
 * del mismo token. En el privado con el bot no aplica: ahí no hay comunidad.
 */

export type CallOutcome = {
  /** Se creó una call nueva en Cabal. */
  created: boolean
  /** El mensaje interesa a todo el chat (la ficha), no solo a quien escribió. */
  broadcast: boolean
  /** null = no hay nada que decir (un CA que no es ningún token). */
  message: BotMessage | null
}

/** El chat desde el que llega el contrato, tal y como está en la BD. */
export type SourceChat = {
  id: string
  provider: string
  chatId: string
  serverId: string | null
  chatType: string
}

const silent: CallOutcome = { created: false, broadcast: false, message: null }

/** Cuenta de Cabal de quien escribe, por su chat privado con el bot. */
export async function cabalUserForActor(provider: BotProvider, externalUserId: string | null) {
  if (!externalUserId) return null
  const link = await db.chatLink.findFirst({
    where: { provider, externalUserId, chatType: 'private', active: true },
    select: { user: { select: { id: true, handle: true } } },
  })
  return link?.user ?? null
}

export async function handleContractFromBot(input: {
  provider: BotProvider
  actorId: string | null
  chat: SourceChat | null
  contract: string
  note: string
  lang: Lang
  mode: 'command' | 'pasted'
}): Promise<CallOutcome> {
  const tx = t(input.lang)
  const contract = input.contract.trim()
  const fail = (text: string): CallOutcome =>
    input.mode === 'pasted' ? silent : { created: false, broadcast: false, message: { text } }

  if (!looksLikeContract(contract)) return fail(tx.callBadContract)

  // Una sola consulta: DexScreener dice en qué red vive el token (el usuario
  // solo pega el CA) y de paso da el precio y el MC de la entrada
  const snap = await fetchCallSnapshot(contract)
  if (!snap.found) return fail(tx.callTokenNotFound)

  const token = {
    contract,
    network: snap.network,
    name: snap.name,
    symbol: snap.symbol,
    priceUsd: snap.priceUsd,
    mc: snap.mc,
    liquidityUsd: snap.liquidityUsd,
    change24h: snap.change24h,
  }

  // Sin cuenta conectada no hay call, pero la ficha se enseña igual: es la
  // forma de que alguien descubra que puede conectar la suya.
  const user = await cabalUserForActor(input.provider, input.actorId)
  if (!user) {
    if (input.mode === 'command') {
      return { created: false, broadcast: false, message: { text: tx.callNeedsAccount(`${siteUrl()}/app`, input.provider) } }
    }
    return {
      created: false,
      broadcast: true,
      message: await tokenCard(token, input.lang, { footer: tx.callConnectHint(`${siteUrl()}/app`, input.provider) }),
    }
  }

  // "Primera call": en una comunidad el token se llama una vez
  const previous = await firstCallInCommunity(input.chat, contract)
  if (previous) {
    return {
      created: false,
      broadcast: true,
      message: await tokenCard(token, input.lang, {
        footer: tx.callFirstBy(userLink(previous.user.handle), previous.entryMc),
        postId: previous.id,
      }),
    }
  }

  // El mismo límite que en la web, para que el bot no sea la puerta de atrás
  const limit = await rateLimit(`post:${user.id}`, 10, 60)
  if (!limit.ok) return fail(tx.callTooFast)

  const post = await db.post.create({
    data: {
      kind: 'call',
      content: (input.note.trim() || defaultNote(snap.symbol || snap.name)).slice(0, 1000),
      userId: user.id,
      contract,
      network: snap.network,
      entryPriceUsd: snap.priceUsd,
      entryMc: snap.mc,
      chatLinkId: input.chat?.id ?? null,
    },
  })
  // Los puntos son los mismos que en la web: una call puntúa como comentario
  await awardPoints(user.id, 'comment', 'Call publicada desde el bot')
  await invalidate('feed:*')

  const stats = await callerStatsBlock(user.id, input.lang)
  const card = await tokenCard(token, input.lang, {
    head: tx.callHead(userLink(user.handle)),
    note: input.note.trim(),
    footer: stats ? `${tx.callEntrySaved}\n\n${stats}` : tx.callEntrySaved,
    postId: post.id,
  })
  return {
    created: true,
    broadcast: true,
    message: {
      ...card,
      buttons: [...(card.buttons ?? []), ...callerStatsButtons(user.handle, input.lang)],
      image: callCardUrl(post.id),
    },
  }
}

/** Redes contra las que se prueba el formato del CA cuando no se sabe cuál es. */
const ANY_NETWORK = ['solana', 'ethereum', 'tron'] as const

export function looksLikeContract(v: string): boolean {
  return ANY_NETWORK.some((n) => isValidContract(n, v))
}

function defaultNote(symbol: string): string {
  return symbol ? `Call de $${symbol}` : 'Call'
}

/**
 * La primera call de ese token en la comunidad del chat, si la hay. En un
 * privado siempre devuelve null: un DM no es comunidad de nadie.
 */
async function firstCallInCommunity(chat: SourceChat | null, contract: string) {
  if (!chat) return null
  const key = communityKeyOf(chat)
  if (!key) return null
  const scope = await chatLinkIdsOf(key)
  if (scope.length === 0) return null
  return db.post.findFirst({
    where: { kind: 'call', contract, chatLinkId: { in: scope } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, entryMc: true, user: { select: { handle: true } } },
  })
}

// ---------- Ficha del token ----------

type TokenInfo = {
  contract: string
  network: string
  name: string
  symbol: string
  priceUsd: number | null
  mc: number | null
  liquidityUsd: number | null
  change24h: number | null
}

async function tokenCard(
  token: TokenInfo,
  lang: Lang,
  extra: { head?: string; note?: string; footer?: string; postId?: string }
): Promise<BotMessage> {
  const tx = t(lang)
  const label = token.symbol
    ? `$${esc(token.symbol)}${token.name ? ` · ${esc(token.name)}` : ''}`
    : esc(token.name || token.contract)

  const lines: string[] = []
  if (extra.head) lines.push(extra.head, '')
  lines.push(`<b>${label}</b> · ${esc(networkMeta(token.network).label)}`)

  const facts = [
    token.priceUsd !== null ? `💵 ${fmtPrice(token.priceUsd)}` : null,
    token.mc !== null ? `📊 MC ${fmtUsd(token.mc)}` : null,
    token.liquidityUsd !== null ? `💧 ${tx.liquidity} ${fmtUsd(token.liquidityUsd)}` : null,
    token.change24h !== null ? `${token.change24h >= 0 ? '📈' : '📉'} 24h ${fmtPct(token.change24h)}` : null,
  ].filter(Boolean)
  if (facts.length) lines.push(facts.join(' · '))

  if (extra.note) lines.push('', esc(extra.note.slice(0, 600)))
  lines.push('', `<code>${esc(token.contract)}</code>`)
  if (extra.footer) lines.push('', extra.footer)

  return { text: lines.join('\n'), buttons: await tokenButtons(token, lang, extra.postId) }
}

/** Botones de compra de las plataformas afiliadas + ver la call en Cabal. */
async function tokenButtons(token: TokenInfo, lang: Lang, postId?: string): Promise<BotButton[][]> {
  const tx = t(lang)
  const platforms = await db.affiliatePlatform
    .findMany({
      where: { active: true, OR: [{ url: { not: '' } }, { links: { not: '{}' } }] },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    .catch(() => [])

  const buys: BotButton[] = []
  for (const p of platforms) {
    const url = platformLinkFor({ url: p.url, links: parseAffiliateLinks(p.links) }, token.network, token.contract)
    // Máximo 6 plataformas: más botones que eso tapan el mensaje
    if (url && buys.length < 6) buys.push({ text: p.name, url })
  }

  const rows: BotButton[][] = []
  for (let i = 0; i < buys.length; i += 2) rows.push(buys.slice(i, i + 2))
  rows.push([{ text: postId ? tx.viewCallOnCabal : tx.openCabal, url: postId ? callUrl(postId) : `${siteUrl()}/app` }])
  return rows
}

/** La call en el feed de Cabal. */
export function callUrl(postId: string): string {
  return `${siteUrl()}/app?post=${encodeURIComponent(postId)}`
}

/** Imagen con el resultado de la call, la misma que se descarga desde la web. */
export function callCardUrl(postId: string): string {
  return `${siteUrl()}/api/posts/${encodeURIComponent(postId)}/card`
}

// ---------- /pnl ----------

/**
 * La tarjeta de resultado de una call propia: /pnl <CA> devuelve cómo va la
 * call que esa persona dio de ese token. Si dio varias del mismo token, la más
 * reciente. La imagen la genera /api/posts/[id]/card, que ya existía para
 * compartir resultados desde la web.
 */
export async function pnlMessage(input: {
  provider: BotProvider
  actorId: string | null
  contract: string
  lang: Lang
}): Promise<BotMessage> {
  const tx = t(input.lang)
  const contract = input.contract.trim()
  if (!looksLikeContract(contract)) return { text: tx.callBadContract }

  const user = await cabalUserForActor(input.provider, input.actorId)
  if (!user) return { text: tx.callNeedsAccount(`${siteUrl()}/app`, input.provider) }

  const post = await db.post.findFirst({
    where: { kind: 'call', userId: user.id, contract },
    orderBy: { createdAt: 'desc' },
    select: { id: true, userId: true, network: true, contract: true, createdAt: true, entryPriceUsd: true, entryMc: true, peakMultiple: true },
  })
  if (!post?.contract || !post.network) return { text: tx.pnlNoCall }

  const result = await liveCallResult({ ...post, network: post.network, contract: post.contract })

  const symbol = result.symbol ? `$${esc(result.symbol)}` : esc(contract.slice(0, 8))
  const lines = [
    tx.pnlHead(userLink(user.handle), symbol),
    `${tx.pnlEntry} ${result.entryMc !== null ? fmtUsd(result.entryMc) : '—'} → ${
      result.currentMc !== null ? fmtUsd(result.currentMc) : '—'
    } · <b>${fmtMultiple(result.multiple)}</b>`,
    `${tx.pnlPeak} <b>${fmtMultiple(result.peakMultiple)}</b>${result.peakMc !== null ? ` (${fmtUsd(result.peakMc)})` : ''}`,
  ]

  return {
    text: lines.join('\n'),
    image: callCardUrl(post.id),
    buttons: [[{ text: tx.viewCallOnCabal, url: callUrl(post.id) }]],
  }
}

// ---------- Formato ----------

export function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

/**
 * Un token de meme vale fracciones de céntimo, así que no sirve con dos
 * decimales: se enseñan 4 cifras significativas ($0.000002713), que es como lo
 * escribe la gente. Solo por debajo de 1e-9 cae a notación científica.
 */
function fmtPrice(n: number): string {
  if (n >= 1) return `$${n.toFixed(4)}`
  return `$${Number(n.toPrecision(4))}`
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}
