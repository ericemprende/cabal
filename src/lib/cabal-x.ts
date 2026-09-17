/**
 * Identidad de Cabal en X, sin ninguna dependencia de servidor.
 *
 * Vive aparte de follow-x.ts a propósito: aquel importa Prisma para leer las
 * reglas de puntos, y el pie de la landing —que es un componente de cliente—
 * solo necesita el @usuario y el enlace. Importar follow-x desde el cliente
 * arrastraría la base de datos al bundle del navegador.
 */

/** Cuenta oficial del proyecto en X. */
export const CABAL_X_HANDLE = 'Cabal_app'
export const CABAL_X_URL = `https://x.com/${CABAL_X_HANDLE}`

/** Intent de seguir: abre X con el botón "Seguir" ya apuntando a Cabal. */
export function followIntentUrl(): string {
  return `https://x.com/intent/follow?screen_name=${CABAL_X_HANDLE}`
}
