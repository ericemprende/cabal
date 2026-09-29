import { randomInt } from 'node:crypto'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import type { BotProvider } from '@/lib/bot-message'

/**
 * Registro de los comandos de los bots (tabla BotCommandLog): qué se usa,
 * cuánto tarda y qué falla. Un fallo recibe un código ERR-XXXXXX que el bot
 * enseña al usuario; con él se encuentra el error en /admin → Salud.
 *
 * Escribir el registro nunca puede tumbar el comando: sus errores se tragan.
 */

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O ni 1/I: se dictan
const KEEP_DAYS = 30

export function newErrorRef(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += REF_CHARS[randomInt(REF_CHARS.length)]
  return `ERR-${s}`
}

type LogInput = {
  provider: BotProvider
  command: string
  chatId?: string | null
  actorId?: string | null
}

/** Guarda una ejecución. Devuelve el código de error si `error` viene. */
export async function logBotCommand(
  input: LogInput & { ms: number; error?: unknown }
): Promise<string | null> {
  const errorRef = input.error === undefined ? null : newErrorRef()
  if (errorRef) console.error(`[${input.provider}] /${input.command} ${errorRef}`, errMsg(input.error))
  await db.botCommandLog
    .create({
      data: {
        provider: input.provider,
        command: input.command.slice(0, 40),
        chatId: input.chatId ?? null,
        actorId: input.actorId ?? null,
        ms: Math.round(input.ms),
        ok: !errorRef,
        errorRef,
        error: errorRef ? errMsg(input.error).slice(0, 1000) : null,
      },
    })
    .catch((e) => console.error('[bot-log]', (e as Error).message))
  maybePurge()
  return errorRef
}

/**
 * Ejecuta un comando midiendo su tiempo. Si lanza, lo registra y llama a
 * `onError` con el código (para contestar al usuario); no relanza.
 */
export async function trackBotCommand<T>(
  input: LogInput,
  work: () => Promise<T>,
  onError?: (errorRef: string) => Promise<unknown> | unknown
): Promise<T | undefined> {
  const start = performance.now()
  try {
    const out = await work()
    void logBotCommand({ ...input, ms: performance.now() - start })
    return out
  } catch (error) {
    const ref = await logBotCommand({ ...input, ms: performance.now() - start, error })
    if (ref && onError) await Promise.resolve(onError(ref)).catch(() => {})
    return undefined
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// Purga de lo viejo, como mucho una vez por hora por proceso
let lastPurge = 0
function maybePurge() {
  const now = Date.now()
  if (now - lastPurge < 3_600_000) return
  lastPurge = now
  db.botCommandLog
    .deleteMany({ where: { createdAt: { lt: new Date(now - KEEP_DAYS * 86_400_000) } } })
    .catch(() => {})
}

// ---------- Métricas para /admin ----------

export type BotMetricsDTO = {
  hours: number
  total: number
  errors: number
  byProvider: { provider: string; total: number; errors: number }[]
  commands: { command: string; total: number; errors: number; avgMs: number; p95Ms: number }[]
  recentErrors: {
    errorRef: string
    provider: string
    command: string
    chatId: string | null
    error: string
    at: string
  }[]
  lastSeen: { provider: string; at: string }[]
}

export async function botMetrics(hours: number, ref?: string | null): Promise<BotMetricsDTO> {
  const since = new Date(Date.now() - hours * 3_600_000)
  const [rows, errors, lastSeen] = await Promise.all([
    db.$queryRaw<
      { provider: string; command: string; total: bigint; errors: bigint; avg: number; p95: number }[]
    >`
      SELECT provider, command, COUNT(*) AS total,
             COUNT(*) FILTER (WHERE NOT ok) AS errors,
             AVG(ms)::float AS avg,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY ms)::float AS p95
      FROM "BotCommandLog" WHERE "createdAt" >= ${since}
      GROUP BY provider, command`,
    db.botCommandLog.findMany({
      where: ref ? { errorRef: ref.trim().toUpperCase() } : { ok: false, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { errorRef: true, provider: true, command: true, chatId: true, error: true, createdAt: true },
    }),
    db.botCommandLog.groupBy({ by: ['provider'], _max: { createdAt: true } }),
  ])

  const byCmd = new Map<string, { total: number; errors: number; msSum: number; p95: number }>()
  const byProv = new Map<string, { total: number; errors: number }>()
  for (const r of rows) {
    const total = Number(r.total)
    const errs = Number(r.errors)
    const c = byCmd.get(r.command) ?? { total: 0, errors: 0, msSum: 0, p95: 0 }
    c.total += total
    c.errors += errs
    c.msSum += r.avg * total
    c.p95 = Math.max(c.p95, r.p95) // aproximado al juntar proveedores
    byCmd.set(r.command, c)
    const p = byProv.get(r.provider) ?? { total: 0, errors: 0 }
    p.total += total
    p.errors += errs
    byProv.set(r.provider, p)
  }

  const commands = [...byCmd.entries()]
    .map(([command, c]) => ({
      command,
      total: c.total,
      errors: c.errors,
      avgMs: Math.round(c.msSum / c.total),
      p95Ms: Math.round(c.p95),
    }))
    .sort((a, b) => b.total - a.total)

  return {
    hours,
    total: commands.reduce((s, c) => s + c.total, 0),
    errors: commands.reduce((s, c) => s + c.errors, 0),
    byProvider: [...byProv.entries()].map(([provider, p]) => ({ provider, ...p })),
    commands,
    recentErrors: errors.map((e) => ({
      errorRef: e.errorRef ?? '',
      provider: e.provider,
      command: e.command,
      chatId: e.chatId,
      error: e.error ?? '',
      at: e.createdAt.toISOString(),
    })),
    lastSeen: lastSeen
      .filter((l) => l._max.createdAt)
      .map((l) => ({ provider: l.provider, at: l._max.createdAt!.toISOString() })),
  }
}

// ---------- Límite de uso ----------

const BOT_LIMIT = 12 // comandos por minuto y persona (/call además tiene el suyo)

/**
 * true si esa persona ya ha pasado del límite de comandos este minuto. Sin
 * Redis no limita (ver lib/rate-limit). Los fallos también se registran, para
 * ver en /admin quién está martilleando el bot.
 */
export async function botRateLimited(input: LogInput): Promise<boolean> {
  if (!input.actorId) return false
  const r = await rateLimit(`bot:${input.provider}:${input.actorId}`, BOT_LIMIT, 60)
  if (r.ok) return false
  void logBotCommand({ ...input, command: `${input.command} (límite)`, ms: 0 })
  return true
}
