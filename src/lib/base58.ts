// Base58 (Bitcoin alphabet) sin dependencias externas.
// Se usa para comparar pubkeys de Solana que llegan como bytes del RPC.

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const ALPHABET_MAP = new Map<string, number>()
for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP.set(ALPHABET[i], i)

/** bytes → base58 string */
export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const digits: number[] = [0]
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i]
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  // ceros líder → '1'
  let out = ''
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += ALPHABET[0]
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]]
  return out
}

/** base58 string → bytes (null si inválido) */
export function base58Decode(str: string): Uint8Array | null {
  if (!str) return null
  const bytes: number[] = [0]
  for (let i = 0; i < str.length; i++) {
    const value = ALPHABET_MAP.get(str[i])
    if (value === undefined) return null
    let carry = value
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58
      bytes[j] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (let i = 0; i < str.length && str[i] === ALPHABET[0]; i++) bytes.push(0)
  return new Uint8Array(bytes.reverse())
}
