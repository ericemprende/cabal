/**
 * Voto en contra de un proyecto (el "popó", al lado del fueguito).
 *
 * La regla que lo hace útil: no se puede votar en contra sin escribir por qué.
 * El motivo se publica como comentario firmado en el hilo del proyecto, donde
 * le pueden responder — y quien vota puede retractarse si le convencen.
 */

/** Mínimo del motivo: "scam" o "basura" no es una razón. */
export const FUD_REASON_MIN = 25
export const FUD_REASON_MAX = 500

/** Qué le falta al motivo para poder publicarse (null = está listo). */
export function fudReasonError(reason: string): string | null {
  const clean = reason.trim()
  if (clean.length < FUD_REASON_MIN) {
    return `Te faltan ${FUD_REASON_MIN - clean.length} caracteres: explica qué viste que no te cuadra`
  }
  return null
}
