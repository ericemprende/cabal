/**
 * Mensaje de bot independiente del proveedor (Telegram y Discord).
 *
 * El texto se escribe en el subconjunto de HTML que acepta Telegram
 * (<b>, <i>, <a href>, <code>) porque es el que ya usaban los textos del bot;
 * para Discord se traduce a Markdown en el momento de enviar (htmlToMarkdown).
 * Los botones con `url` son enlaces en los dos; los que llevan `callback_data`
 * son las pulsaciones que el bot atiende (callback_query en Telegram,
 * custom_id de un componente en Discord).
 */

export type BotProvider = 'telegram' | 'discord'

export const BOT_PROVIDERS: readonly BotProvider[] = ['telegram', 'discord'] as const

export const PROVIDER_NAMES: Record<BotProvider, string> = { telegram: 'Telegram', discord: 'Discord' }

export function isBotProvider(v: unknown): v is BotProvider {
  return v === 'telegram' || v === 'discord'
}

export type BotButton = { text: string; url?: string; callback_data?: string }

export type BotMessage = {
  text: string
  buttons?: BotButton[][]
  /**
   * Imagen que acompaña al mensaje (la tarjeta de resultado de una call). En
   * Telegram va como sendPhoto con el texto de pie; en Discord, como embed.
   * Telegram corta el pie de foto a 1024 caracteres, bastante menos que un
   * mensaje normal, así que un texto con imagen conviene que sea corto.
   */
  image?: string
}

/** Escapa texto para el HTML de los mensajes. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

/** Deshace `esc` (y las entidades más comunes) para los proveedores sin HTML. */
export function unesc(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
}

/**
 * Pasa el HTML de los mensajes a Markdown de Discord. Solo conoce las etiquetas
 * que usan los textos del bot; cualquier otra se cae y queda su contenido, así
 * un texto nuevo nunca llega con `<b>` a la vista.
 */
export function htmlToMarkdown(html: string): string {
  const md = html
    .replace(/<a\s+href="([^"]*)"\s*>([\s\S]*?)<\/a>/gi, (_m, url: string, text: string) => `[${unesc(text)}](${unesc(url)})`)
    .replace(/<\/?(b|strong)>/gi, '**')
    .replace(/<\/?(i|em)>/gi, '*')
    .replace(/<\/?code>/gi, '`')
    .replace(/<[^>]+>/g, '')
  return unesc(md)
}
