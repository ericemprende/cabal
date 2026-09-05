/**
 * Verificación criptográfica de la posesión de una wallet.
 * - Solana (y redes base58): firma ed25519-detached con tweetnacl.
 * - EVM (ethereum/base/bsc/robinhood): personal_sign → ecrecover con ethers.
 * El mensaje debe contener la dirección; así la firma queda ligada a ella.
 */

import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { verifyMessage } from 'ethers'

export function walletMessage(address: string): string {
  return `Cabal: verifico que soy el dueño de la wallet ${address}\nFirmar este mensaje es seguro y no da acceso a tus fondos.`
}

export function verifyWalletSignature(
  network: string,
  address: string,
  message: string,
  signature: string
): boolean {
  try {
    const evm = ['ethereum', 'base', 'bsc', 'robinhood'].includes(network)
    if (evm) {
      // EVM: recover → la dirección recuperada debe coincidir
      const recovered = verifyMessage(message, signature)
      return recovered.toLowerCase() === address.toLowerCase() && message.includes(address)
    }
    // Solana / base58: ed25519 detached
    if (!message.includes(address)) return false
    const sigBytes = bs58.decode(signature)
    const pubBytes = bs58.decode(address)
    const msgBytes = new TextEncoder().encode(message)
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes)
  } catch {
    return false
  }
}
