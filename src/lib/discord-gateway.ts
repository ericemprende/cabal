import { db } from '@/lib/db'
import { dcSend, discordConfig, type DiscordConfig } from '@/lib/discord'
import { handleContractFromBot, looksLikeContract } from '@/lib/bot-call'
import { isLang, langFromLocale, type Lang } from '@/lib/bot-i18n'

/**
 * Conexión permanente con Discord (gateway), solo para una cosa: enterarse de
 * los contratos que la gente pega en los canales.
 *
 * El endpoint de interacciones que usa el resto del bot NUNCA recibe mensajes
 * normales: Discord solo manda por ahí comandos y botones. Para leer lo que se
 * escribe en un canal hace falta este WebSocket y el permiso privilegiado
 * "Message Content", que se activa a mano en el portal de desarrolladores.
 * Si no está activado, Discord cierra con 4014 y se deja de reintentar: el
 * error queda guardado para que el panel admin lo enseñe.
 *
 * Vive en el mismo proceso que el worker de avisos (ver lib/notify-worker), que
 * es quien lo arranca y lo para según el bot esté conectado o pausado. No usa
 * ninguna librería: WebSocket es global en Node y en Bun.
 */

const INTENTS = 1 + 512 + 32768 // GUILDS + GUILD_MESSAGES + MESSAGE_CONTENT
const GATEWAY_ERROR_KEY = 'discord_gateway_error'

// Códigos de op del protocolo
const OP = { dispatch: 0, heartbeat: 1, identify: 2, resume: 6, reconnect: 7, invalidSession: 9, hello: 10, ack: 11 }

/** Cierres que no tiene sentido reintentar: hay que arreglar algo en el portal. */
const FATAL_CLOSE = new Map<number, string>([
  [4004, 'El token del bot no vale (autenticación rechazada).'],
  [4010, 'Shard mal configurado.'],
  [4011, 'El bot necesita sharding: hay demasiados servidores.'],
  [4013, 'Intents no válidos.'],
  [
    4014,
    'Falta el permiso "Message Content". Actívalo en el portal de Discord → tu aplicación → Bot → Privileged Gateway Intents.',
  ],
])

const MAX_BACKOFF_MS = 60_000

type Conn = {
  ws: WebSocket
  /** Para reanudar sin perder mensajes tras una caída. */
  sessionId: string | null
  resumeUrl: string | null
  seq: number | null
  heartbeat: ReturnType<typeof setInterval> | null
  /** El último latido no fue contestado: la conexión está muerta aunque parezca viva. */
  awaitingAck: boolean
  closed: boolean
}

type State = {
  token: string | null
  conn: Conn | null
  retries: number
  timer: ReturnType<typeof setTimeout> | null
  /** Error que no se reintenta (falta un permiso, token inválido…). */
  fatal: string | null
}

// El estado vive en globalThis: en desarrollo, Next recarga los módulos y si no
// se quedarían conexiones huérfanas abiertas contra Discord.
const g = globalThis as unknown as { __cabalDiscordGateway?: State }
const state: State = (g.__cabalDiscordGateway ??= { token: null, conn: null, retries: 0, timer: null, fatal: null })

/**
 * Arranca, para o reconecta según la configuración. Lo llama el worker de
 * avisos en cada pasada, así que conectar el bot desde el panel basta para que
 * el gateway aparezca solo en menos de un minuto.
 */
export async function syncDiscordGateway() {
  if (process.env.DISCORD_GATEWAY === 'off') return
  const cfg = await discordConfig()
  const wanted = cfg?.enabled ? cfg.token : null

  if (!wanted) return stopGateway()
  // Token distinto: se reconecta con el nuevo y se olvida el error anterior
  if (state.token && state.token !== wanted) {
    stopGateway()
  }
  if (state.conn || state.timer) return
  if (state.fatal) return // no se reintenta hasta que cambie el token

  state.token = wanted
  connect(cfg!)
}

export function stopGateway() {
  if (state.timer) clearTimeout(state.timer)
  state.timer = null
  closeConn()
  state.token = null
  state.retries = 0
  state.fatal = null
}

function closeConn() {
  const conn = state.conn
  state.conn = null
  if (!conn) return
  conn.closed = true
  if (conn.heartbeat) clearInterval(conn.heartbeat)
  try {
    conn.ws.close(1000)
  } catch {
    /* ya estaba cerrado */
  }
}

function connect(cfg: DiscordConfig, resume?: { sessionId: string; resumeUrl: string; seq: number | null }) {
  const url = `${resume?.resumeUrl ?? 'wss://gateway.discord.gg'}/?v=10&encoding=json`
  let ws: WebSocket
  try {
    ws = new WebSocket(url)
  } catch (e) {
    return scheduleReconnect(cfg, (e as Error).message)
  }

  const conn: Conn = {
    ws,
    sessionId: resume?.sessionId ?? null,
    resumeUrl: resume?.resumeUrl ?? null,
    seq: resume?.seq ?? null,
    heartbeat: null,
    awaitingAck: false,
    closed: false,
  }
  state.conn = conn

  const send = (op: number, d: unknown) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ op, d }))
  }

  ws.onmessage = (ev) => {
    let payload: { op: number; d?: unknown; s?: number | null; t?: string | null }
    try {
      payload = JSON.parse(String(ev.data))
    } catch {
      return
    }
    if (typeof payload.s === 'number') conn.seq = payload.s

    switch (payload.op) {
      case OP.hello: {
        const interval = (payload.d as { heartbeat_interval?: number })?.heartbeat_interval ?? 41_250
        conn.heartbeat = setInterval(() => {
          // Un latido sin respuesta significa conexión zombi: se corta y se reanuda
          if (conn.awaitingAck) return void ws.close(4000)
          conn.awaitingAck = true
          send(OP.heartbeat, conn.seq)
        }, interval)
        if (resume?.sessionId) {
          send(OP.resume, { token: cfg.token, session_id: resume.sessionId, seq: conn.seq })
        } else {
          send(OP.identify, {
            token: cfg.token,
            intents: INTENTS,
            properties: { os: 'linux', browser: 'cabal', device: 'cabal' },
          })
        }
        return
      }
      case OP.ack:
        conn.awaitingAck = false
        return
      case OP.heartbeat:
        send(OP.heartbeat, conn.seq)
        return
      case OP.reconnect:
        return void ws.close(4000)
      case OP.invalidSession:
        // d=false: la sesión no se puede reanudar, hay que identificarse de cero
        conn.sessionId = null
        return void ws.close(4000)
      case OP.dispatch:
        return onDispatch(cfg, conn, payload.t ?? '', payload.d)
    }
  }

  ws.onerror = () => {
    /* el cierre llega por onclose; aquí solo se evita el unhandled error */
  }

  ws.onclose = (ev) => {
    if (conn.heartbeat) clearInterval(conn.heartbeat)
    if (conn.closed) return // lo cerramos nosotros a propósito
    state.conn = null
    const fatal = FATAL_CLOSE.get(ev.code)
    if (fatal) return void markFatal(fatal)
    scheduleReconnect(cfg, `cierre ${ev.code}`, conn)
  }
}

function onDispatch(cfg: DiscordConfig, conn: Conn, type: string, d: unknown) {
  if (type === 'READY') {
    const ready = d as { session_id?: string; resume_gateway_url?: string }
    conn.sessionId = ready.session_id ?? null
    conn.resumeUrl = ready.resume_gateway_url ?? null
    state.retries = 0
    void clearFatal()
    console.log('[discord-gateway] conectado')
    return
  }
  if (type === 'RESUMED') {
    state.retries = 0
    return
  }
  if (type === 'MESSAGE_CREATE') void onMessage(cfg, d as GatewayMessage)
}

type GatewayMessage = {
  content?: string
  channel_id?: string
  guild_id?: string
  author?: { id?: string; bot?: boolean }
  /** Solo en servidores; sirve para saber el idioma preferido si algún día hace falta. */
  member?: { user?: { id?: string } }
}

/**
 * Un mensaje en un canal: si trae un contrato y el canal está conectado con
 * Cabal, se responde con la ficha del token y, cuando toca, se publica la call.
 */
async function onMessage(cfg: DiscordConfig, msg: GatewayMessage) {
  try {
    if (!msg.content || !msg.channel_id || msg.author?.bot) return
    const contract = findContract(msg.content)
    if (!contract) return

    const chat = await db.chatLink.findUnique({
      where: { provider_chatId: { provider: 'discord', chatId: msg.channel_id } },
    })
    if (!chat?.active) return

    const lang: Lang = isLang(chat.lang) ? chat.lang : langFromLocale(null)
    const { message } = await handleContractFromBot({
      provider: 'discord',
      actorId: msg.author?.id ?? null,
      chat,
      contract,
      note: '',
      lang,
      mode: 'pasted',
    })
    if (message) await dcSend(cfg.token, msg.channel_id, message)
  } catch (e) {
    console.error('[discord-gateway] mensaje:', (e as Error).message)
  }
}

/**
 * Primer contrato que aparece en un texto. El patrón es amplio a propósito
 * (una palabra larga en base58 puede no ser un CA), así que después se valida
 * con looksLikeContract y, más adelante, contra DexScreener.
 */
const CONTRACT_PATTERN = /(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/g

function findContract(text: string): string | null {
  for (const match of text.match(CONTRACT_PATTERN) ?? []) {
    if (looksLikeContract(match)) return match
  }
  return null
}

function scheduleReconnect(cfg: DiscordConfig, reason: string, conn?: Conn) {
  state.retries++
  const delay = Math.min(1000 * 2 ** Math.min(state.retries, 6), MAX_BACKOFF_MS)
  console.error(`[discord-gateway] ${reason}; reintento en ${Math.round(delay / 1000)}s`)
  state.timer = setTimeout(() => {
    state.timer = null
    const resume = conn?.sessionId && conn.resumeUrl ? { sessionId: conn.sessionId, resumeUrl: conn.resumeUrl, seq: conn.seq } : undefined
    connect(cfg, resume)
  }, delay)
}

async function markFatal(message: string) {
  state.fatal = message
  closeConn()
  console.error('[discord-gateway]', message)
  await db.setting
    .upsert({ where: { key: GATEWAY_ERROR_KEY }, update: { value: message }, create: { key: GATEWAY_ERROR_KEY, value: message } })
    .catch(() => {})
}

async function clearFatal() {
  state.fatal = null
  await db.setting.deleteMany({ where: { key: GATEWAY_ERROR_KEY } }).catch(() => {})
}

/** Para el panel admin: qué impide que el gateway funcione, si algo lo impide. */
export async function discordGatewayStatus(): Promise<{ connected: boolean; error: string | null }> {
  const row = await db.setting.findUnique({ where: { key: GATEWAY_ERROR_KEY } }).catch(() => null)
  return { connected: state.conn !== null && !state.fatal, error: state.fatal ?? row?.value ?? null }
}

/** Al reconectar el bot desde el panel, se olvida el error y se reintenta. */
export async function resetDiscordGateway() {
  stopGateway()
  await clearFatal()
}
