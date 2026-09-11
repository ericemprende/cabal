/**
 * Comprar el token sin salir de Cabal (Solana, vía Jupiter Terminal).
 *
 * Jupiter Terminal corre entero en el navegador del usuario: cotiza, arma la
 * transacción y la manda a firmar con SU wallet. Cabal nunca ve ni toca una
 * clave privada — solo configura qué contrato comprar y a qué cuenta va la
 * comisión.
 *
 * La comisión necesita una "Referral Account" creada en referral.jup.ag con
 * la wallet que la va a recibir (JUPITER_REFERRAL_ACCOUNT abajo) — es un
 * trámite de un par de clics en su panel, firmado por esa wallet, que Cabal
 * no puede hacer por su cuenta al no tener la clave privada. Sin esa cuenta
 * configurada, el botón de comprar sigue funcionando igual; simplemente no
 * se cobra comisión todavía.
 */

export type SwapFeeConfig = {
  /** Cuenta de referido de Jupiter (referral.jup.ag), no la wallet en sí. */
  referralAccount: string
  feeBps: number
}

const DEFAULT_FEE_BPS = 35

export function swapFeeConfig(): SwapFeeConfig | null {
  const referralAccount = process.env.JUPITER_REFERRAL_ACCOUNT?.trim()
  if (!referralAccount) return null
  const feeBps = Math.round(Number(process.env.SOLANA_FEE_BPS ?? DEFAULT_FEE_BPS))
  return { referralAccount, feeBps: Number.isFinite(feeBps) && feeBps > 0 ? feeBps : DEFAULT_FEE_BPS }
}

/** Wallet a la que apunta la comisión, solo para mostrarla en el panel de admin. */
export function feeWalletHint(): string | null {
  return process.env.SOLANA_FEE_WALLET?.trim() || null
}

export const SOL_MINT = 'So11111111111111111111111111111111111111112'
