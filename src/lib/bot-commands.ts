import { db } from '@/lib/db'
import { siteUrl } from '@/lib/waitlist'
import { fmtLaunchDate, launchUrl } from '@/lib/notifications'
import { esc, type BotButton, type BotMessage, type BotProvider } from '@/lib/bot-message'
import { CHAT_PREFS, type ChatPref } from '@/lib/chat-links'
import { LANGS, LANG_NAMES, t, type Lang } from '@/lib/bot-i18n'
import { REMINDER_LEADS, leadLabel } from '@/lib/notify-types'

/**
 * Las respuestas que son iguales en Telegram y en Discord: el saludo, los
 * próximos lanzamientos y los botones de ajustes e idioma. Cada bot se encarga
 * solo de recibir el comando y de pintar el resultado con su API.
 */

export function settingsButtons(
  chat: Record<ChatPref, boolean> & { reminderLeadMin: number },
  lang: Lang
): BotButton[][] {
  const tx = t(lang)
  return [
    ...CHAT_PREFS.map((p) => [{ text: `${chat[p] ? '✅' : '⬜️'} ${tx.prefs[p]}`, callback_data: `pref:${p}` }]),
    leadButtons(chat.reminderLeadMin),
    languageButtons(lang),
  ]
}

/** Con cuánta antelación avisa este chat de un lanzamiento. */
export function leadButtons(current: number): BotButton[] {
  return REMINDER_LEADS.map((m) => ({
    text: `${current === m ? '• ' : ''}${leadLabel(m)}`,
    callback_data: `lead:${m}`,
  }))
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
