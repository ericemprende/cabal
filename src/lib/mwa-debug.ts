/**
 * Diagnóstico temporal de Mobile Wallet Adapter en la app Android (TWA):
 * sin cable USB no hay consola remota, así que se guardan los últimos
 * avisos/errores de la página y se pintan en un recuadro sobre la app cuando
 * se usa MWA, para poder mandar una captura.
 */

const MAX = 40
const lines: string[] = []
let box: HTMLDivElement | null = null
let hooked = false

function stamp() {
  const d = new Date()
  return `${d.getMinutes()}:${String(d.getSeconds()).padStart(2, '0')}`
}

function fmt(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}${(a as { code?: unknown }).code ? ` [${(a as { code?: unknown }).code}]` : ''}`
      if (typeof a === 'string') return a
      try {
        return JSON.stringify(a)
      } catch {
        return String(a)
      }
    })
    .join(' ')
    .slice(0, 300)
}

export function mwaLog(...args: unknown[]) {
  lines.push(`${stamp()} ${fmt(args)}`)
  if (lines.length > MAX) lines.shift()
  render()
}

/** Se engancha a console.warn/error y a las promesas rechazadas (solo Android). */
export function startMwaDebug() {
  if (hooked || typeof window === 'undefined' || !/android/i.test(navigator.userAgent)) return
  hooked = true
  for (const level of ['warn', 'error'] as const) {
    const orig = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      lines.push(`${stamp()} ${level}: ${fmt(args)}`)
      if (lines.length > MAX) lines.shift()
      render()
      orig(...args)
    }
  }
  window.addEventListener('unhandledrejection', (e) => mwaLog('rechazo:', e.reason))
  window.addEventListener('error', (e) => mwaLog('error:', e.message))
  document.addEventListener('visibilitychange', () => mwaLog('visible:', document.visibilityState))
}

/** Muestra el recuadro (se llama al elegir Mobile Wallet Adapter). */
export function showMwaDebug() {
  if (typeof document === 'undefined') return
  if (!box) {
    box = document.createElement('div')
    box.style.cssText =
      'position:fixed;left:8px;right:8px;bottom:8px;max-height:45vh;overflow:auto;z-index:2147483647;' +
      'background:rgba(0,0,0,.92);color:#9f9;font:11px/1.35 monospace;padding:8px 8px 8px 8px;' +
      'border:1px solid #3a3;border-radius:8px;white-space:pre-wrap;word-break:break-all'
    box.addEventListener('click', () => {
      box?.remove()
      box = null
    })
    document.body.appendChild(box)
  }
  render()
}

function render() {
  if (!box) return
  box.textContent = `MWA debug (toca para cerrar)\nUA: ${navigator.userAgent}\nref: ${document.referrer}\n\n${lines.join('\n')}`
  box.scrollTop = box.scrollHeight
}
