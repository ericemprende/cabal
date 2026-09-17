import { PROVIDER_NAMES, type BotProvider } from '@/lib/bot-message'

/**
 * Textos de los bots de Cabal (Telegram y Discord) en español e inglés.
 *
 * Los comandos son siempre en inglés (/start, /settings…); lo que cambia es el
 * texto de las respuestas y de los avisos. Cada chat guarda su idioma
 * (ChatLink.lang): al vincularlo se toma el de la app de quien lo conecta y se
 * cambia con /language o desde el perfil en la web.
 *
 * El texto se escribe en el HTML que acepta Telegram; para Discord se traduce a
 * Markdown al enviarlo (lib/bot-message → htmlToMarkdown).
 */

export const LANGS = ['es', 'en'] as const
export type Lang = (typeof LANGS)[number]

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v)
}

/** Idioma de la app de quien escribe ("es", "es-419", "en-US"…) → idioma del bot. */
export function langFromLocale(code: string | undefined | null): Lang {
  return code?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export const LANG_NAMES: Record<Lang, string> = { es: '🇪🇸 Español', en: '🇬🇧 English' }

/** Comandos del bot con su descripción por idioma. Se registran en los dos proveedores. */
export const BOT_COMMANDS: Record<Lang, { command: string; description: string }[]> = {
  en: [
    { command: 'start', description: 'Connect with your Cabal account' },
    { command: 'settings', description: 'Choose which alerts this chat gets' },
    { command: 'upcoming', description: 'Upcoming launches' },
    { command: 'call', description: 'Post a token call on Cabal' },
    { command: 'language', description: 'Español / English' },
    { command: 'unlink', description: 'Stop alerts in this chat' },
    { command: 'help', description: 'How the bot works' },
  ],
  es: [
    { command: 'start', description: 'Conectar con tu cuenta de Cabal' },
    { command: 'settings', description: 'Elegir qué avisos llegan a este chat' },
    { command: 'upcoming', description: 'Próximos lanzamientos' },
    { command: 'call', description: 'Publicar una call de token en Cabal' },
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
  onlyGroupAdminLinks: (p: BotProvider) =>
    `Solo un administrador del ${p === 'discord' ? 'servidor' : 'grupo'} puede conectarlo con Cabal.`,
  badCode: (url: string, p: BotProvider) =>
    `Ese código no vale o ya caducó. Genera uno nuevo en <a href="${url}">Cabal</a> → tu perfil → ${PROVIDER_NAMES[p]}.`,
  linkedPrivate: (user: string) =>
    `✅ Listo, este chat está conectado con <b>${user}</b>.\n\nTe avisaré aquí de los launches en los que actives la 🔔 campanita, 1 hora antes. Si quieres además todos los lanzamientos o las tesis, actívalos abajo o usa /settings.`,
  linkedGroup: (title: string, user: string) =>
    `✅ <b>${title}</b> quedó conectado con Cabal (vinculado por ${user}).\n\nElige qué avisos quieres recibir aquí:`,
  thisChat: 'Este chat',
  settingsTitle: '⚙️ <b>Avisos de este chat</b>\nToca para activar o desactivar:',
  notLinked: (url: string, p: BotProvider) =>
    `Este chat no está conectado con Cabal. Entra en <a href="${url}">Cabal</a> → tu perfil → ${PROVIDER_NAMES[p]} y genera un código.`,
  onlyManagerUnlinks: 'Solo quien lo conectó o un administrador puede desvincularlo.',
  unlinked: 'Hecho: este chat ya no recibirá avisos de Cabal. Puedes volver a conectarlo cuando quieras desde tu perfil.',
  noLongerLinked: 'Este chat ya no está conectado',
  onlyAdminChanges: 'Solo un administrador puede cambiarlo',
  languagePrompt: '🌐 Elige el idioma del bot en este chat:',
  languageSet: 'Idioma: Español',
  noUpcoming: 'No hay lanzamientos programados ahora mismo.',
  upcomingTitle: '🗓 <b>Próximos lanzamientos</b>',
  welcome: (isPrivate: boolean, p: BotProvider) => {
    const name = PROVIDER_NAMES[p]
    const how = isPrivate
      ? p === 'discord'
        ? `Para conectarlo con tu cuenta entra en Cabal → tu perfil → <b>${name}</b>, genera un código y escríbeme aquí <code>/link CÓDIGO</code>.`
        : `Para conectarlo con tu cuenta entra en Cabal → tu perfil → <b>${name}</b> → <b>Conectar mi ${name}</b>.`
      : `Para recibir avisos aquí, un administrador del ${p === 'discord' ? 'servidor' : 'grupo'} genera un código en Cabal → perfil → <b>${name}</b> y lo envía con <code>/link CÓDIGO</code>.`
    return `👋 <b>Bot de Cabal</b>\n\nTe aviso de los lanzamientos, de los que están por salir y de las tesis de la comunidad, sin tener que estar mirando la web.\n\n${how}\n\n/upcoming — próximos lanzamientos\n/settings — qué avisos llegan aquí\n/language — Español / English\n/unlink — dejar de recibir avisos`
  },
  newLaunch: '🚀 <b>Nuevo lanzamiento en Cabal</b>',
  bellHead: (inText: string) => `🔔 <b>Tu recordatorio: sale en ${inText}</b>`,
  soonHead: (inText: string) => `⏰ <b>Sale en ${inText}</b>`,
  inPrefix: 'en',
  byDev: 'Publicado por el dev',
  byCommunity: 'Compartido por',
  thesisHead: (user: string) => `🧠 <b>Nueva tesis de ${user}</b>`,
  about: 'Sobre',
  testMessage: '✅ <b>Prueba de Cabal</b>\nEl bot está conectado y puede escribir en este chat.',
  // ---- /call ----
  liquidity: 'Liq.',
  callHead: (user: string) => `🎯 <b>Nueva call de ${user}</b>`,
  callUsage: 'Escribe <code>/call CONTRATO</code> y, si quieres, tu tesis detrás.',
  callBadContract: 'Ese contrato no tiene buena pinta. Pega el CA completo del token.',
  callTokenNotFound:
    'No encuentro ese token en DexScreener. Comprueba el CA o espera a que tenga par de liquidez.',
  callEntrySaved: '📌 Entrada guardada: el resultado de la call se mide desde este precio.',
  callNeedsAccount: (url: string, p: BotProvider) =>
    `Para dar una call necesitas tu cuenta de Cabal conectada a ${PROVIDER_NAMES[p]}. Entra en <a href="${url}">Cabal</a> → tu perfil → ${PROVIDER_NAMES[p]} y conecta tu chat privado con el bot.`,
  viewCallOnCabal: 'Ver la call en Cabal',
  callFailed: 'No he podido publicar la call. Inténtalo otra vez en un momento.',
  callTooFast: 'Vas muy rápido con las calls. Espera un minuto y vuelve a intentarlo.',
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
  onlyGroupAdminLinks: (p: BotProvider) =>
    `Only a ${p === 'discord' ? 'server' : 'group'} admin can connect this chat to Cabal.`,
  badCode: (url: string, p: BotProvider) =>
    `That code is invalid or expired. Get a new one at <a href="${url}">Cabal</a> → your profile → ${PROVIDER_NAMES[p]}.`,
  linkedPrivate: (user: string) =>
    `✅ Done, this chat is connected to <b>${user}</b>.\n\nI'll message you here 1 hour before the launches where you turn on the 🔔 bell. Want every launch or the theses too? Turn them on below or use /settings.`,
  linkedGroup: (title: string, user: string) =>
    `✅ <b>${title}</b> is now connected to Cabal (linked by ${user}).\n\nChoose which alerts to get here:`,
  thisChat: 'This chat',
  settingsTitle: '⚙️ <b>Alerts for this chat</b>\nTap to turn on or off:',
  notLinked: (url: string, p: BotProvider) =>
    `This chat isn't connected to Cabal. Go to <a href="${url}">Cabal</a> → your profile → ${PROVIDER_NAMES[p]} and get a code.`,
  onlyManagerUnlinks: 'Only whoever connected it or an admin can unlink it.',
  unlinked: "Done: this chat won't get Cabal alerts anymore. You can connect it again anytime from your profile.",
  noLongerLinked: 'This chat is no longer connected',
  onlyAdminChanges: 'Only an admin can change this',
  languagePrompt: '🌐 Choose the bot language for this chat:',
  languageSet: 'Language: English',
  noUpcoming: 'No launches scheduled right now.',
  upcomingTitle: '🗓 <b>Upcoming launches</b>',
  welcome: (isPrivate: boolean, p: BotProvider) => {
    const name = PROVIDER_NAMES[p]
    const how = isPrivate
      ? p === 'discord'
        ? `To connect it with your account go to Cabal → your profile → <b>${name}</b>, get a code and send me <code>/link CODE</code> here.`
        : `To connect it with your account go to Cabal → your profile → <b>${name}</b> → <b>Connect my ${name}</b>.`
      : `To get alerts here, a ${p === 'discord' ? 'server' : 'group'} admin creates a code in Cabal → profile → <b>${name}</b> and sends it with <code>/link CODE</code>.`
    return `👋 <b>Cabal bot</b>\n\nI'll alert you about new launches, the ones about to go live and community theses, without having to keep checking the site.\n\n${how}\n\n/upcoming — upcoming launches\n/settings — which alerts arrive here\n/language — Español / English\n/unlink — stop alerts`
  },
  newLaunch: '🚀 <b>New launch on Cabal</b>',
  bellHead: (inText: string) => `🔔 <b>Your reminder: live in ${inText}</b>`,
  soonHead: (inText: string) => `⏰ <b>Live in ${inText}</b>`,
  inPrefix: 'in',
  byDev: 'Posted by the dev',
  byCommunity: 'Shared by',
  thesisHead: (user: string) => `🧠 <b>New thesis by ${user}</b>`,
  about: 'About',
  testMessage: '✅ <b>Cabal test</b>\nThe bot is connected and can post in this chat.',
  liquidity: 'Liq.',
  callHead: (user: string) => `🎯 <b>New call by ${user}</b>`,
  callUsage: 'Send <code>/call CONTRACT</code>, and your thesis after it if you want.',
  callBadContract: "That contract doesn't look right. Paste the token's full CA.",
  callTokenNotFound:
    "I can't find that token on DexScreener. Check the CA or wait until it has a liquidity pair.",
  callEntrySaved: '📌 Entry saved: the call result is measured from this price.',
  callNeedsAccount: (url: string, p: BotProvider) =>
    `To post a call you need your Cabal account connected to ${PROVIDER_NAMES[p]}. Go to <a href="${url}">Cabal</a> → your profile → ${PROVIDER_NAMES[p]} and connect your private chat with the bot.`,
  viewCallOnCabal: 'View the call on Cabal',
  callFailed: "I couldn't post the call. Try again in a moment.",
  callTooFast: "You're posting calls too fast. Wait a minute and try again.",
}

const DICTS: Record<Lang, Dict> = { es, en }

export function t(lang: string | null | undefined): Dict {
  return DICTS[isLang(lang) ? lang : 'es']
}
