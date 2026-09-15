/**
 * Arma una nota corta y legible de qué cambió en un launch, para mostrarla como
 * actividad reciente ("Fulano actualizó..."). null si no hubo ningún cambio de
 * verdad (evita que guardar sin tocar nada aparezca como una actualización).
 */

type Comparable = {
  name: string
  ticker: string | null
  network: string
  launchAt: Date
  dateConfirmed: boolean
  description: string
  image: string | null
  banner: string | null
  website: string | null
  twitter: string | null
  telegram: string | null
  contract: string | null
  isLive: boolean
  liveUrl: string | null
}

export function buildLaunchChangeNote(before: Comparable, after: Comparable): string | null {
  const notes: string[] = []

  // La confirmación de fecha es la nota más relevante: se distingue de un simple
  // cambio de horario porque es la respuesta a "¿ya se sabe la fecha de verdad?".
  if (!before.dateConfirmed && after.dateConfirmed) {
    notes.push('confirmó la fecha de lanzamiento')
  } else if (+before.launchAt !== +after.launchAt) {
    notes.push('cambió la fecha de lanzamiento')
  } else if (before.dateConfirmed && !after.dateConfirmed) {
    notes.push('marcó la fecha como estimada, aún sin confirmar')
  }

  if (before.description !== after.description) notes.push('actualizó la descripción')
  if (before.name !== after.name) notes.push('cambió el nombre')
  if (before.ticker !== after.ticker) notes.push('actualizó el ticker')
  if (before.network !== after.network) notes.push('cambió de red')
  if (before.image !== after.image || before.banner !== after.banner) notes.push('actualizó las imágenes')
  if (before.website !== after.website || before.twitter !== after.twitter || before.telegram !== after.telegram) {
    notes.push('actualizó los enlaces')
  }
  if (before.contract !== after.contract) notes.push('cambió el contrato')
  if (before.isLive !== after.isLive || before.liveUrl !== after.liveUrl) notes.push('actualizó el stream en vivo')

  if (!notes.length) return null
  const text = notes.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
