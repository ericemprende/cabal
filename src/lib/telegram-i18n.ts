/**
 * Textos del bot de Telegram en español e inglés.
 *
 * Los comandos son siempre en inglés (/start, /settings…); lo que cambia es el
 * texto de las respuestas y de los avisos. Cada chat guarda su idioma
 * (ChatLink.lang): al vincularlo se toma el de la app de Telegram de quien lo
 * conecta y se cambia con /language o desde el perfil en la web.
 */

export const LANGS = ['es', 'en'] as const
export type Lang = (typeof LANGS)[number]

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v)
}

/** language_code de Telegram ("es", "es-419", "en-US"…) → idioma del bot. */
export function langFromTelegram(code: string | undefined | null): Lang {
  return code?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export const LANG_NAMES: Record<Lang, string> = { es: '🇪🇸 Español', en: '🇬🇧 English' }

/** Comandos que se registran en Telegram (setMyCommands), por idioma de la app. */
export const BOT_COMMANDS: Record<Lang, { command: string; description: string }[]> = {
  en: [
    { command: 'start', description: 'Connect with your Cabal account' },
    { command: 'settings', description: 'Choose which alerts this chat gets' },
    { command: 'upcoming', description: 'Upcoming launches' },
    { command: 'language', description: 'Español / English' },
    { command: 'unlink', description: 'Stop alerts in this chat' },
    { command: 'help', description: 'How the bot works' },
  ],
  es: [
    { command: 'start', description: 'Conectar con tu cuenta de Cabal' },
    { command: 'settings', description: 'Elegir qué avisos llegan a este chat' },
    { command: 'upcoming', description: 'Próximos lanzamientos' },
    { command: 'language', description: 'Español / English' },
    { command: 'unlink', description: 'Dejar de recibir avisos aquí' },
    { command: 'help', description: 'Cómo funciona el bot' },
  ],
}

const es = {
  locale: 'es',
  prefs: {
    notifyLaunches: 'Lanzamientos nuevos',
    notifyReminders: 'Aviso 1 h antes de cada launch',
    notifyTheses: 'Tesis nuevas',
  },
  on: 'activado',
  off: 'desactivado',
  estimated: 'estimada',
  days: 'días',
  openCabal: 'Abrir Cabal',
  viewOnCabal: 'Ver en Cabal',
  readOnCabal: 'Leer en Cabal',
  seeAll: 'Ver todos en Cabal',
  onlyGroupAdminLinks: 'Solo un administrador del grupo puede conectarlo con Cabal.',
  badCode: (url: string) =>
    `Ese código no vale o ya caducó. Genera uno nuevo en <a href="${url}">Cabal</a> → tu perfil → Telegram.`,
  linkedPrivate: (handle: string) =>
    `✅ Listo, este chat está conectado con <b>@${handle}</b>.\n\nTe avisaré aquí de los launches en los que actives la 🔔 campanita, 1 hora antes. Si quieres además todos los lanzamientos o las tesis, actívalos abajo o usa /settings.`,
  linkedGroup: (title: string, handle: string) =>
    `✅ <b>${title}</b> quedó conectado con Cabal (vinculado por @${handle}).\n\nElige qué avisos quieres recibir aquí:`,
  thisChat: 'Este chat',
  settingsTitle: '⚙️ <b>Avisos de este chat</b>\nToca para activar o desactivar:',
  notLinked: (url: string) =>
    `Este chat no está conectado con Cabal. Entra en <a href="${url}">Cabal</a> → tu perfil → Telegram y genera un enlace.`,
  onlyManagerUnlinks: 'Solo quien lo conectó o un administrador puede desvincularlo.',
  unlinked: 'Hecho: este chat ya no recibirá avisos de Cabal. Puedes volver a conectarlo cuando quieras desde tu perfil.',
  noLongerLinked: 'Este chat ya no está conectado',
  onlyAdminChanges: 'Solo un administrador puede cambiarlo',
  languagePrompt: '🌐 Elige el idioma del bot en este chat:',
  languageSet: 'Idioma: Español',
  noUpcoming: 'No hay lanzamientos programados ahora mismo.',
  upcomingTitle: '🗓 <b>Próximos lanzamientos</b>',
  welcome: (isPrivate: boolean) =>
    `👋 <b>Bot de Cabal</b>\n\nTe aviso de los lanzamientos, de los que están por salir y de las tesis de la comunidad, sin tener que estar mirando la web.\n\n${
      isPrivate
        ? 'Para conectarlo con tu cuenta entra en Cabal → tu perfil → <b>Telegram</b> → <b>Conectar mi Telegram</b>.'
        : 'Para recibir avisos aquí, un administrador genera un código en Cabal → perfil → <b>Telegram</b> → <b>Añadir a un grupo o canal</b> y lo envía con <code>/link CÓDIGO</code>.'
    }\n\n/upcoming — próximos lanzamientos\n/settings — qué avisos llegan aquí\n/language — Español / English\n/unlink — dejar de recibir avisos`,
  newLaunch: '🚀 <b>Nuevo lanzamiento en Cabal</b>',
  bellHead: (inText: string) => `🔔 <b>Tu recordatorio: sale en ${inText}</b>`,
  soonHead: (inText: string) => `⏰ <b>Sale en ${inText}</b>`,
  inPrefix: 'en',
  byDev: 'Publicado por el dev',
  byCommunity: 'Compartido por',
  thesisHead: (handle: string) => `🧠 <b>Nueva tesis de @${handle}</b>`,
  about: 'Sobre',
  testMessage: '✅ <b>Prueba de Cabal</b>\nEl bot está conectado y puede escribir en este chat.',
}

type Dict = typeof es

const en: Dict = {
  locale: 'en',
  prefs: {
    notifyLaunches: 'New launches',
    notifyReminders: '1 h before every launch',
    notifyTheses: 'New theses',
  },
  on: 'on',
  off: 'off',
  estimated: 'estimated',
  days: 'days',
  openCabal: 'Open Cabal',
  viewOnCabal: 'View on Cabal',
  readOnCabal: 'Read on Cabal',
  seeAll: 'See all on Cabal',
  onlyGroupAdminLinks: 'Only a group admin can connect this chat to Cabal.',
  badCode: (url: string) =>
    `That code is invalid or expired. Get a new one at <a href="${url}">Cabal</a> → your profile → Telegram.`,
  linkedPrivate: (handle: string) =>
    `✅ Done, this chat is connected to <b>@${handle}</b>.\n\nI'll message you here 1 hour before the launches where you turn on the 🔔 bell. Want every launch or the theses too? Turn them on below or use /settings.`,
  linkedGroup: (title: string, handle: string) =>
    `✅ <b>${title}</b> is now connected to Cabal (linked by @${handle}).\n\nChoose which alerts to get here:`,
  thisChat: 'This chat',
  settingsTitle: '⚙️ <b>Alerts for this chat</b>\nTap to turn on or off:',
  notLinked: (url: string) =>
    `This chat isn't connected to Cabal. Go to <a href="${url}">Cabal</a> → your profile → Telegram and create a link.`,
  onlyManagerUnlinks: 'Only whoever connected it or an admin can unlink it.',
  unlinked: "Done: this chat won't get Cabal alerts anymore. You can connect it again anytime from your profile.",
  noLongerLinked: 'This chat is no longer connected',
  onlyAdminChanges: 'Only an admin can change this',
  languagePrompt: '🌐 Choose the bot language for this chat:',
  languageSet: 'Language: English',
  noUpcoming: 'No launches scheduled right now.',
  upcomingTitle: '🗓 <b>Upcoming launches</b>',
  welcome: (isPrivate: boolean) =>
    `👋 <b>Cabal bot</b>\n\nI'll alert you about new launches, the ones about to go live and community theses, without having to keep checking the site.\n\n${
      isPrivate
        ? 'To connect it with your account go to Cabal → your profile → <b>Telegram</b> → <b>Connect my Telegram</b>.'
        : 'To get alerts here, an admin creates a code in Cabal → profile → <b>Telegram</b> → <b>Add to a group or channel</b> and sends it with <code>/link CODE</code>.'
    }\n\n/upcoming — upcoming launches\n/settings — which alerts arrive here\n/language — Español / English\n/unlink — stop alerts`,
  newLaunch: '🚀 <b>New launch on Cabal</b>',
  bellHead: (inText: string) => `🔔 <b>Your reminder: live in ${inText}</b>`,
  soonHead: (inText: string) => `⏰ <b>Live in ${inText}</b>`,
  inPrefix: 'in',
  byDev: 'Posted by the dev',
  byCommunity: 'Shared by',
  thesisHead: (handle: string) => `🧠 <b>New thesis by @${handle}</b>`,
  about: 'About',
  testMessage: '✅ <b>Cabal test</b>\nThe bot is connected and can post in this chat.',
}

const DICTS: Record<Lang, Dict> = { es, en }

export function t(lang: string | null | undefined): Dict {
  return DICTS[isLang(lang) ? lang : 'es']
}
