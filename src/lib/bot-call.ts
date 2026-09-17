import { db } from '@/lib/db'
import { awardPoints } from '@/lib/api-helpers'
import { invalidate } from '@/lib/cache'
import { rateLimit } from '@/lib/rate-limit'
import { networkMeta } from '@/lib/cabal'
import { siteUrl } from '@/lib/waitlist'
import { fetchCallSnapshot, isValidContract } from '@/lib/chain-stats'
import { parseAffiliateLinks, platformLinkFor } from '@/lib/affiliate'
import { userLink } from '@/lib/notifications'
import { esc, type BotButton, type BotMessage, type BotProvider } from '@/lib/bot-message'
import { t, type Lang } from '@/lib/bot-i18n'

/**
 * El comando /call de los bots: publicar una call de token desde Telegram o
 * Discord y que salga en Cabal como cualquier otra (feed, perfil del autor y
 * ranking de Top Callers).
 *
 * Es la misma call que se publica desde la web (Post kind="call"): se guarda el
 * precio y el market cap del instante exacto, que es lo que luego compara
 * lib/call-results para sacar el multiplicador. Por eso aquí no se inventa nada
 * nuevo, solo se entra por otra puerta.
 *
 * Para publicar hace falta que quien escribe tenga SU cuenta de Cabal conectada
 * (su chat privado con el bot). No vale la cuenta de quien conectó el grupo: la
 * call cuenta para el Cabal Score de quien la da, así que tiene que ser suya.
 *
 * La respuesta del bot lleva los datos del token y los botones de compra de las
 * plataformas afiliadas, que son los mismos enlaces con referido que la web.
 */

export type CallOutcome =
  | { ok: true; message: BotMessage }
  | { ok: false; message: BotMessage }

/** Cuenta de Cabal de quien escribe, por su chat privado con el bot. */
export async function cabalUserForActor(provider: BotProvider, externalUserId: string | null) {
  if (!externalUserId) return null
  const link = await db.chatLink.findFirst({
    where: { provider, externalUserId, chatType: 'private', active: true },
    select: { user: { select: { id: true, handle: true } } },
  })
  return link?.user ?? null
}

/**
 * Publica la call y devuelve el mensaje que contesta el bot. Nunca lanza por
 * un token que no existe o un CA mal escrito: eso se responde como texto.
 */
export async function createCallFromBot(input: {
  provider: BotProvider
  actorId: string | null
  contract: string
  note: string
  lang: Lang
}): Promise<CallOutcome> {
  const tx = t(input.lang)
  const contract = input.contract.trim()

  const user = await cabalUserForActor(input.provider, input.actorId)
  if (!user) return { ok: false, message: { text: tx.callNeedsAccount(`${siteUrl()}/app`, input.provider) } }

  // El mismo límite que en la web, para que el bot no sea la puerta de atrás
  const limit = await rateLimit(`post:${user.id}`, 10, 60)
  if (!limit.ok) return { ok: false, message: { text: tx.callTooFast } }

  // Sin red no se puede validar el formato: se acepta cualquiera de las conocidas
  if (!ANY_NETWORK.some((n) => isValidContract(n, contract))) {
    return { ok: false, message: { text: tx.callBadContract } }
  }

  // Una sola consulta: DexScreener dice en qué red vive el token (el usuario
  // solo pega el CA) y de paso da el precio y el MC de la entrada
  const snap = await fetchCallSnapshot(contract)
  if (!snap.found) return { ok: false, message: { text: tx.callTokenNotFound } }

  const post = await db.post.create({
    data: {
      kind: 'call',
      content: (input.note.trim() || defaultNote(snap.symbol || snap.name)).slice(0, 1000),
      userId: user.id,
      contract,
      network: snap.network,
      entryPriceUsd: snap.priceUsd,
      entryMc: snap.mc,
    },
  })
  // Los puntos son los mismos que en la web: una call puntúa como comentario
  await awardPoints(user.id, 'comment', 'Call publicada desde el bot')
  await invalidate('feed:*')

  return {
    ok: true,
    message: await callMessage({
      handle: user.handle,
      postId: post.id,
      contract,
      network: snap.network,
      name: snap.name,
      symbol: snap.symbol,
      priceUsd: snap.priceUsd,
      mc: snap.mc,
      liquidityUsd: snap.liquidityUsd,
      change24h: snap.change24h,
      note: input.note.trim(),
      lang: input.lang,
    }),
  }
}

/** Redes contra las que se prueba el formato del CA cuando no se sabe cuál es. */
const ANY_NETWORK = ['solana', 'ethereum', 'tron'] as const

function defaultNote(symbol: string): string {
  return symbol ? `Call de $${symbol}` : 'Call'
}

// ---------- Mensaje ----------

async function callMessage(c: {
  handle: string
  postId: string
  contract: string
  network: string
  name: string
  symbol: string
  priceUsd: number | null
  mc: number | null
  liquidityUsd: number | null
  change24h: number | null
  note: string
  lang: Lang
}): Promise<BotMessage> {
  const tx = t(c.lang)
  const label = c.symbol ? `$${esc(c.symbol)}${c.name ? ` · ${esc(c.name)}` : ''}` : esc(c.name || c.contract)
  const lines = [
    tx.callHead(userLink(c.handle)),
    '',
    `<b>${label}</b> · ${esc(networkMeta(c.network).label)}`,
  ]
  const facts = [
    c.priceUsd !== null ? `💵 ${fmtPrice(c.priceUsd)}` : null,
    c.mc !== null ? `📊 MC ${fmtUsd(c.mc)}` : null,
    c.liquidityUsd !== null ? `💧 ${tx.liquidity} ${fmtUsd(c.liquidityUsd)}` : null,
    c.change24h !== null ? `${c.change24h >= 0 ? '📈' : '📉'} 24h ${fmtPct(c.change24h)}` : null,
  ].filter(Boolean)
  if (facts.length) lines.push(facts.join(' · '))
  if (c.note) lines.push('', esc(c.note.slice(0, 600)))
  lines.push('', `<code>${esc(c.contract)}</code>`)
  lines.push('', tx.callEntrySaved)

  return { text: lines.join('\n'), buttons: await callButtons(c.network, c.contract, c.postId, c.lang) }
}

/** Botones de compra de las plataformas afiliadas + ver la call en Cabal. */
async function callButtons(network: string, contract: string, postId: string, lang: Lang): Promise<BotButton[][]> {
  const tx = t(lang)
  const platforms = await db.affiliatePlatform
    .findMany({
      where: { active: true, OR: [{ url: { not: '' } }, { links: { not: '{}' } }] },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    .catch(() => [])

  const buys: BotButton[] = []
  for (const p of platforms) {
    const url = platformLinkFor({ url: p.url, links: parseAffiliateLinks(p.links) }, network, contract)
    // Máximo 6 plataformas: más botones que eso tapan el mensaje
    if (url && buys.length < 6) buys.push({ text: p.name, url })
  }

  const rows: BotButton[][] = []
  for (let i = 0; i < buys.length; i += 2) rows.push(buys.slice(i, i + 2))
  rows.push([{ text: tx.viewCallOnCabal, url: callUrl(postId) }])
  return rows
}

/** La call en el feed de Cabal. */
export function callUrl(postId: string): string {
  return `${siteUrl()}/app?post=${encodeURIComponent(postId)}`
}

// ---------- Formato ----------

function fmtUsd(n: number): string {
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
