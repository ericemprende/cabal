/**
 * Helpers de cliente para comprar en redes EVM (Ethereum, Base, BNB Chain)
 * con MetaMask o cualquier otro proveedor inyectado en window.ethereum
 * (estándar EIP-1193) — análogo a phantomProvider() para Solana, pero sin
 * un objeto estable: hay que llamar eth_requestAccounts, asegurarse de estar
 * en la red correcta, y a veces firmar un typed-data (Permit2) antes de
 * mandar la transacción.
 */

import type { EvmTxToSignDTO, Permit2Eip712DTO } from '@/lib/types'

export type EvmNetwork = 'ethereum' | 'base' | 'bsc'

export const EVM_CHAIN_ID: Record<EvmNetwork, number> = {
  ethereum: 1,
  base: 8453,
  bsc: 56,
}

export const EVM_EXPLORER: Record<EvmNetwork, string> = {
  ethereum: 'https://etherscan.io',
  base: 'https://basescan.org',
  bsc: 'https://bscscan.com',
}

/** Parámetros para wallet_addEthereumChain, por si MetaMask no tiene la red agregada todavía. */
const CHAIN_PARAMS: Record<EvmNetwork, Record<string, unknown>> = {
  ethereum: {
    chainId: '0x1',
    chainName: 'Ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth.llamarpc.com'],
    blockExplorerUrls: [EVM_EXPLORER.ethereum],
  },
  base: {
    chainId: '0x2105', // 8453
    chainName: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: [EVM_EXPLORER.base],
  },
  bsc: {
    chainId: '0x38', // 56
    chainName: 'BNB Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: [EVM_EXPLORER.bsc],
  },
}

export function isEvmNetwork(network: string): network is EvmNetwork {
  return network === 'ethereum' || network === 'base' || network === 'bsc'
}

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export function evmProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { ethereum?: Eip1193Provider }
  return w.ethereum ?? null
}

/** Conecta (eth_requestAccounts) y devuelve la primera cuenta, o null si el usuario canceló o no hay proveedor. */
export async function connectEvmWallet(): Promise<string | null> {
  const p = evmProvider()
  if (!p) return null
  try {
    const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[]
    return accounts?.[0] ?? null
  } catch {
    return null // el usuario rechazó la conexión
  }
}

/**
 * Asegura que la wallet esté en la red correcta antes de firmar — si no la
 * tiene agregada (error 4902 de MetaMask), la agrega con los parámetros
 * estándar de esa red.
 */
export async function ensureEvmChain(network: EvmNetwork): Promise<void> {
  const p = evmProvider()
  if (!p) throw new Error('No hay wallet EVM instalada')
  const chainIdHex = `0x${EVM_CHAIN_ID[network].toString(16)}`
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] })
  } catch (err) {
    const code = (err as { code?: number })?.code
    if (code === 4902) {
      await p.request({ method: 'wallet_addEthereumChain', params: [CHAIN_PARAMS[network]] })
    } else {
      throw err
    }
  }
}

/**
 * Anexa la firma de Permit2 a `transaction.data`, siguiendo el formato que
 * documenta 0x para "Permit2 Signature": la longitud de la firma, como
 * uint256 big-endian de 32 bytes, seguida de la firma misma, ambas
 * concatenadas al final de la data original de la transacción.
 *
 * OJO: esto se interpretó de la documentación pública de 0x v2 y NO se pudo
 * verificar contra una respuesta real de la API al escribir este código —
 * antes de manejar dinero real, confirmar el formato exacto contra
 * https://0x.org/docs/api (guía "Submit the Transaction" de Permit2).
 */
function attachPermit2Signature(data: string, signatureHex: string): string {
  const sig = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex
  const sigLengthBytes = sig.length / 2
  const lengthHex = sigLengthBytes.toString(16).padStart(64, '0') // uint256, 32 bytes
  return data + lengthHex + sig
}

/**
 * Firma (si 0x pidió permit2) y manda la transacción de compra armada por
 * buildBuyTransactionEvm/buildBuyEvm. Devuelve el hash de la transacción.
 */
export async function signAndSendEvmBuy(opts: {
  network: EvmNetwork
  from: string
  transaction: EvmTxToSignDTO
  permit2Eip712: Permit2Eip712DTO | null
}): Promise<string> {
  const p = evmProvider()
  if (!p) throw new Error('No hay wallet EVM instalada')

  let data = opts.transaction.data
  if (opts.permit2Eip712) {
    const signature = (await p.request({
      method: 'eth_signTypedData_v4',
      params: [opts.from, JSON.stringify(opts.permit2Eip712)],
    })) as string
    data = attachPermit2Signature(data, signature)
  }

  const txHash = (await p.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: opts.from,
        to: opts.transaction.to,
        data,
        value: opts.transaction.value && opts.transaction.value !== '0' ? `0x${BigInt(opts.transaction.value).toString(16)}` : '0x0',
      },
    ],
  })) as string
  return txHash
}
