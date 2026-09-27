/**
 * "Arreglar enlaces": Telegram y Discord ya no previsualizan bien los posts de
 * X (sale el enlace pelado, sin texto ni imagen). Si alguien pega uno en un
 * grupo vinculado, el bot responde con el mismo post por fixupx.com, que sí
 * trae la vista previa completa. Se activa o apaga por chat (ChatLink.fixLinks).
 */

const X_STATUS = /https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/(\w{1,15})\/status\/(\d{5,25})/gi

/** Como mucho tres por mensaje: un hilo pegado entero no debe inundar el grupo. */
const MAX_LINKS = 3

/** Enlaces de posts de X del texto, ya reescritos. Vacío si no hay ninguno. */
export function fixedXLinks(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(X_STATUS)) {
    const id = m[2]
    if (seen.has(id)) continue
    seen.add(id)
    out.push(`https://fixupx.com/${m[1]}/status/${id}`)
    if (out.length >= MAX_LINKS) break
  }
  return out
}
