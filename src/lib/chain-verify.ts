// Verificación on-chain de "este proyecto es mío".
//
// Solana (RPC público, sin dependencias):
//   1) Si la wallet es la MINT AUTHORITY del token → verificado.
//   2) Si la authority fue revocada (común en pump.fun), busca la PRIMERA
//      transacción del mint (creación) y compara el primer signer (el que
//      pagó y creó el token) con la wallet → verificado como creador.
//   3) Si nada coincide → queda "pending" para revisión del admin.
//
// EVM (ethereum/base/bsc/tron) y robinhood: sin API key pública fiable para
// el deployer → pasan directo a revisión del admin (status pending).

import { base58Encode } from '@/lib/base58'

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const RPC_TIMEOUT_MS = 12_000

export type OwnershipCheck = {
  verified: boolean
  method: 'onchain' | 'manual'
  note: string
}

async function rpc(method: string, params: unknown[]): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS)
  try {
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`RPC ${res.status}`)
    const json = await res.json()
    if (json.error) throw new Error(json.error?.message || 'RPC error')
    return json.result
  } finally {
    clearTimeout(timer)
  }
}

function isValidSolanaWallet(wallet: string): boolean {
  const w = wallet.trim()
  if (w.length < 32 || w.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(w)
}

/** 1) Mint authority: getAccountInfo del mint → bytes 4..36 (si COption=1). */
async function checkMintAuthority(mint: string, wallet: string): Promise<boolean> {
  const info = await rpc('getAccountInfo', [mint, { encoding: 'base64' }])
  const value = info?.value
  if (!value?.data?.[0]) return false
  const bytes = Buffer.from(value.data[0], 'base64')
  // SPL Mint: [0..4) COption u32 LE · [4..36) mint authority · [36..44) supply
  if (bytes.length < 36) return false
  const option = bytes.readUInt32LE(0)
  if (option !== 1) return false // authority revocada
  const authority = base58Encode(new Uint8Array(bytes.subarray(4, 36)))
  return authority === wallet.trim()
}

/** 2) Creador: primera firma del mint → primer signer del tx. */
async function checkMintCreator(mint: string, wallet: string): Promise<boolean> {
  // getSignaturesForAddress devuelve de la más NUEVA a la más vieja
  const sigs = await rpc('getSignaturesForAddress', [mint, { limit: 1000 }])
  if (!Array.isArray(sigs) || sigs.length === 0) return false
  const earliest = sigs[sigs.length - 1]
  const firstSig = earliest?.signature
  if (!firstSig) return false
  // Si traemos el histórico cortado (no es la creación real), no afirmamos nada
  if (sigs.length >= 1000) return false
  const tx = await rpc('getTransaction', [
    firstSig,
    { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
  ])
  const keys = tx?.transaction?.message?.accountKeys
  if (!Array.isArray(keys)) return false
  const firstSigner = keys.find((k: any) => k?.signer)?.pubkey
  return !!firstSigner && firstSigner === wallet.trim()
}

export async function verifyProjectOwnership(
  network: string,
  contract: string,
  wallet: string
): Promise<OwnershipCheck> {
  if (network === 'solana') {
    if (!isValidSolanaWallet(wallet)) {
      return { verified: false, method: 'manual', note: 'Wallet de Solana inválida' }
    }
    try {
      if (await checkMintAuthority(contract, wallet)) {
        return { verified: true, method: 'onchain', note: 'Wallet = mint authority del token' }
      }
    } catch (e) {
      return {
        verified: false,
        method: 'manual',
        note: `RPC no disponible (${(e as Error).message}); requiere revisión manual`,
      }
    }
    try {
      if (await checkMintCreator(contract, wallet)) {
        return {
          verified: true,
          method: 'onchain',
          note: 'Wallet = creador del token (primera firma del mint)',
        }
      }
    } catch {
      /* seguimos a revisión manual */
    }
    return {
      verified: false,
      method: 'manual',
      note: 'La wallet no coincide con la authority ni con el creador on-chain; queda en revisión',
    }
  }
  return {
    verified: false,
    method: 'manual',
    note: 'Verificación automática disponible solo en Solana; queda en revisión del equipo',
  }
}
