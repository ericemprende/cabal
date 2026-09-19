import { db } from '@/lib/db'
import { siteUrl } from '@/lib/waitlist'
import { fmtLaunchDate, launchUrl } from '@/lib/notifications'
import { esc, type BotButton, type BotMessage, type BotProvider } from '@/lib/bot-message'
import { CHAT_PREFS, type ChatPref } from '@/lib/chat-links'
import { LANGS, LANG_NAMES, t, type Lang } from '@/lib/bot-i18n'
import { REMINDER_LEADS, leadLabel } from '@/lib/notify-types'
import { MAX_TOKEN_FILTER, normalizeFilterEntry, toggleFilterEntry } from '@/lib/token-filter'

/**
 * Las respuestas que son iguales en Telegram y en Discord: el saludo, los
 * próximos lanzamientos y los botones de ajustes e idioma. Cada bot se encarga
 * solo de recibir el comando y de pintar el resultado con su API.
 */

/** Chat con lo que hace falta para pintar sus ajustes. */
export type SettingsChat = Record<ChatPref, boolean> & { reminderLeads: number[] }

/**
 * La pantalla principal de /settings. La antelación no se despliega aquí: sería
 * una fila de cinco botones más entre los interruptores. Se resume en uno que
 * lleva a su propia pantalla (leadMenu).
 */
export function settingsButtons(chat: SettingsChat, lang: Lang): BotButton[][] {
  const tx = t(lang)
  return [
    ...CHAT_PREFS.map((p) => [{ text: `${chat[p] ? '✅' : '⬜️'} ${tx.prefs[p]}`, callback_data: `pref:${p}` }]),
    [{ text: `⏰ ${tx.leadMenu}: ${leadSummary(chat.reminderLeads)}`, callback_data: 'menu:lead' }],
    languageButtons(lang),
  ]
}

/** Segunda pantalla: qué antelaciones quiere este chat. Se pueden marcar varias. */
export function leadMenuButtons(chat: SettingsChat, lang: Lang): BotButton[][] {
  const tx = t(lang)
  const on = new Set(chat.reminderLeads)
  return [
    ...chunk(
      REMINDER_LEADS.map((m) => ({
        text: `${on.has(m) ? '✅' : '⬜️'} ${leadLabel(m)}`,
        callback_data: `lead:${m}`,
      })),
      3
    ),
    [{ text: `‹ ${tx.back}`, callback_data: 'menu:main' }],
  ]
}

export function leadSummary(leads: number[]): string {
  return leads.length ? [...leads].sort((a, b) => b - a).map(leadLabel).join(' · ') : '—'
}

/** Discord admite 5 botones por fila; con 3 se leen mejor en un móvil. */
function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size))
  return rows
}

export function languageButtons(current?: Lang): BotButton[] {
  return LANGS.map((l) => ({ text: `${current === l ? '• ' : ''}${LANG_NAMES[l]}`, callback_data: `lang:${l}` }))
}

export function welcomeMessage(isPrivate: boolean, provider: BotProvider, lang: Lang): BotMessage {
  const tx = t(lang)
  return {
    text: tx.welcome(isPrivate, provider),
    buttons: [[{ text: tx.openCabal, url: `${siteUrl()}/app` }], languageButtons(lang)],
  }
}

export async function upcomingMessage(lang: Lang): Promise<BotMessage> {
  const tx = t(lang)
  const launches = await db.launch.findMany({
    where: { hidden: false, launchAt: { gt: new Date() } },
    orderBy: { launchAt: 'asc' },
    take: 8,
    select: { id: true, name: true, ticker: true, isPrivate: true, launchAt: true, dateConfirmed: true },
  })
  if (launches.length === 0) return { text: tx.noUpcoming }
  const lines = launches.map((l) => {
    const label = l.ticker && !l.isPrivate ? `$${esc(l.ticker)} · ${esc(l.name)}` : esc(l.name)
    return `• <a href="${launchUrl(l.id)}">${label}</a> — ${fmtLaunchDate(l.launchAt, lang)}${l.dateConfirmed ? '' : ` (${tx.estimated})`}`
  })
  return {
    text: `${tx.upcomingTitle}\n\n${lines.join('\n')}`,
    buttons: [[{ text: tx.seeAll, url: `${siteUrl()}/app` }]],
  }
}

/**
 * /filter: sin argumento enseña el filtro del chat; con un contrato o $TICKER
 * lo añade (o lo quita si ya estaba); con "off" lo vacía. Quien llama ya ha
 * comprobado que el chat existe y, si hay argumento, que puede cambiarlo.
 */
export async function filterCommand(
  chat: { id: string; tokenFilter: string[] },
  arg: string | null,
  lang: Lang
): Promise<string> {
  const tx = t(lang)
  let filter = chat.tokenFilter
  if (arg) {
    if (['off', 'clear', 'none', 'todos', 'all'].includes(arg.toLowerCase())) {
      filter = []
    } else {
      const entry = normalizeFilterEntry(arg)
      if (!entry) return tx.filterBad
      const next = toggleFilterEntry(filter, entry)
      if (next.length === filter.length && !filter.some((f) => f.toLowerCase() === entry.toLowerCase())) {
        return tx.filterFull(MAX_TOKEN_FILTER)
      }
      filter = next
    }
    await db.chatLink.update({ where: { id: chat.id }, data: { tokenFilter: filter } })
  }
  if (filter.length === 0) return tx.filterOff
  return tx.filterOn(filter.map((f) => `• <code>${esc(f)}</code>`).join('\n'))
}
