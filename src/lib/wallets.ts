import bs58 from 'bs58'
import type { Transaction, VersionedTransaction } from '@solana/web3.js'

/**
 * Wallets del navegador, de cualquier marca — no solo Phantom y MetaMask.
 *
 * - Solana: Wallet Standard (el protocolo que usan Phantom, Solflare,
 *   Backpack, OKX, Trust, Coinbase…). Cada wallet se anuncia sola con un
 *   evento; aquí se escucha y se lista.
 * - EVM: EIP-6963. Cada extensión anuncia su propio proveedor EIP-1193, en vez
 *   de pelearse todas por `window.ethereum` (con varias instaladas, la que
 *   gana ahí es la última que cargó, no la que la persona quiere).
 *
 * La wallet elegida y su dirección quedan en un store de módulo compartido
 * por toda la página: conectar una vez en un botón de compra sirve para
 * todos los demás, y evm-wallet.ts firma con el proveedor elegido.
 */

export type WalletFamily = 'solana' | 'evm'

export type WalletOption = {
  id: string
  name: string
  /** data: URI que da la propia wallet. */
  icon: string
}

// ---------- Solana: Wallet Standard ----------

type StdAccount = { address: string; publicKey: Uint8Array; chains: readonly string[]; features: readonly string[] }
type StdWallet = {
  name: string
  icon: string
  chains: readonly string[]
  accounts: readonly StdAccount[]
  features: Record<string, unknown>
}
type ConnectFeature = { connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly StdAccount[] }> }
type SignAndSendFeature = {
  signAndSendTransaction: (
    ...inputs: { account: StdAccount; chain: string; transaction: Uint8Array }[]
  ) => Promise<readonly { signature: Uint8Array }[]>
}
type SignMessageFeature = {
  signMessage: (...inputs: { account: StdAccount; message: Uint8Array }[]) => Promise<readonly { signature: Uint8Array }[]>
}

const SOLANA_MAINNET = 'solana:mainnet'

const stdWallets = new Set<StdWallet>()

/** Lado "app" del protocolo Wallet Standard (lo mismo que hace @wallet-standard/app). */
function startWalletStandard() {
  const api = Object.freeze({
    register(...wallets: StdWallet[]) {
      wallets.forEach((w) => stdWallets.add(w))
      emit()
      return () => {
        wallets.forEach((w) => stdWallets.delete(w))
        emit()
      }
    },
  })
  window.addEventListener('wallet-standard:register-wallet', (e) => {
    try {
      ;(e as CustomEvent<(a: typeof api) => void>).detail(api)
    } catch {
      // una wallet rota no tumba la lista de las demás
    }
  })
  window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }))
}

function isSolanaWallet(w: StdWallet): boolean {
  return (
    w.chains.some((c) => c.startsWith('solana:')) &&
    'standard:connect' in w.features &&
    'solana:signAndSendTransaction' in w.features
  )
}

// ---------- EVM: EIP-6963 ----------

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}
type Eip6963Detail = { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193Provider }

const evmWallets = new Map<string, Eip6963Detail>() // por rdns: la misma extensión no se duplica

function startEip6963() {
  window.addEventListener('eip6963:announceProvider', (e) => {
    const detail = (e as CustomEvent<Eip6963Detail>).detail
    if (!detail?.info?.rdns || !detail.provider) return
    evmWallets.set(detail.info.rdns, detail)
    emit()
  })
  window.dispatchEvent(new Event('eip6963:requestProvider'))
}

// Wallets viejas que solo se inyectan en window.ethereum, sin anunciarse por EIP-6963
const LEGACY_EVM_ID = 'injected'

function legacyEvmProvider(): Eip1193Provider | null {
  const w = window as unknown as { ethereum?: Eip1193Provider }
  return w.ethereum ?? null
}

// ---------- Store compartido ----------

type Connected = { walletId: string; address: string }
const connected: Record<WalletFamily, Connected | null> = { solana: null, evm: null }
const listeners = new Set<() => void>()
let version = 0
let started = false

function emit() {
  version++
  listeners.forEach((l) => l())
}

function ensureStarted() {
  if (started || typeof window === 'undefined') return
  started = true
  startWalletStandard()
  startEip6963()
}

export function subscribeWallets(cb: () => void): () => void {
  ensureStarted()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Cambia cada vez que aparece una wallet o cambia la conectada (para useSyncExternalStore). */
export function walletsVersion(): number {
  return version
}

export function listWallets(family: WalletFamily): WalletOption[] {
  ensureStarted()
  if (typeof window === 'undefined') return []
  if (family === 'solana') {
    return [...stdWallets].filter(isSolanaWallet).map((w) => ({ id: w.name, name: w.name, icon: w.icon }))
  }
  const list: WalletOption[] = [...evmWallets.values()].map(({ info }) => ({ id: info.rdns, name: info.name, icon: info.icon }))
  if (list.length === 0 && legacyEvmProvider()) list.push({ id: LEGACY_EVM_ID, name: 'Wallet del navegador', icon: '' })
  return list
}

export function connectedWallet(family: WalletFamily): (Connected & { name: string }) | null {
  const c = connected[family]
  if (!c) return null
  const w = listWallets(family).find((x) => x.id === c.walletId)
  return w ? { ...c, name: w.name } : null
}

export function disconnectWallet(family: WalletFamily) {
  connected[family] = null
  emit()
}

const LAST_KEY = 'cabal:last-wallet:'

export function lastUsedWallet(family: WalletFamily): string | null {
  try {
    return localStorage.getItem(LAST_KEY + family)
  } catch {
    return null
  }
}

function findStd(id: string): StdWallet {
  const w = [...stdWallets].find((x) => x.name === id && isSolanaWallet(x))
  if (!w) throw new Error('Esa wallet ya no está disponible')
  return w
}

export function evmProviderFor(id: string): Eip1193Provider | null {
  if (id === LEGACY_EVM_ID) return legacyEvmProvider()
  return evmWallets.get(id)?.provider ?? null
}

/** Pide conexión a la wallet elegida y la deja como la activa de su familia. Devuelve la dirección. */
export async function connectWallet(family: WalletFamily, id: string): Promise<string> {
  let address: string | undefined
  if (family === 'solana') {
    const w = findStd(id)
    const res = await (w.features['standard:connect'] as ConnectFeature).connect()
    const accounts = res.accounts.length ? res.accounts : w.accounts
    address = accounts.find((a) => a.chains.includes(SOLANA_MAINNET))?.address ?? accounts[0]?.address
  } else {
    const p = evmProviderFor(id)
    if (!p) throw new Error('Esa wallet ya no está disponible')
    const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[]
    address = accounts?.[0]
  }
  if (!address) throw new Error('La wallet no devolvió ninguna cuenta')
  connected[family] = { walletId: id, address }
  try {
    localStorage.setItem(LAST_KEY + family, id)
  } catch {
    // sin almacenamiento solo se pierde el "última usada"
  }
  emit()
  return address
}

function solanaAccount(): { wallet: StdWallet; account: StdAccount } {
  const c = connected.solana
  if (!c) throw new Error('Conecta una wallet de Solana primero')
  const wallet = findStd(c.walletId)
  const account = wallet.accounts.find((a) => a.address === c.address)
  if (!account) throw new Error('La cuenta conectada ya no está en la wallet; vuelve a conectar')
  return { wallet, account }
}

/** Firma y manda una transacción con la wallet de Solana conectada. Devuelve la firma en base58. */
export async function solanaSignAndSend(tx: Transaction | VersionedTransaction): Promise<string> {
  const { wallet, account } = solanaAccount()
  const bytes =
    'version' in tx ? tx.serialize() : tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  const [out] = await (wallet.features['solana:signAndSendTransaction'] as SignAndSendFeature).signAndSendTransaction({
    account,
    chain: SOLANA_MAINNET,
    transaction: bytes,
  })
  return bs58.encode(out.signature)
}

/** Firma un mensaje con la wallet de Solana conectada. Devuelve la firma en base58. */
export async function solanaSignMessage(message: Uint8Array): Promise<string> {
  const { wallet, account } = solanaAccount()
  const feature = wallet.features['solana:signMessage'] as SignMessageFeature | undefined
  if (!feature) throw new Error(`${wallet.name} no permite firmar mensajes`)
  const [out] = await feature.signMessage({ account, message })
  return bs58.encode(out.signature)
}

/** Proveedor EIP-1193 de la wallet EVM conectada (o, si no hay ninguna elegida, el de window.ethereum). */
export function activeEvmProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null
  ensureStarted()
  const c = connected.evm
  if (c) return evmProviderFor(c.walletId)
  return legacyEvmProvider()
}

/** Wallets conocidas para sugerir cuando no hay ninguna instalada. */
export const SUGGESTED_WALLETS: Record<WalletFamily, { name: string; url: string }[]> = {
  solana: [
    { name: 'Phantom', url: 'https://phantom.com/download' },
    { name: 'Solflare', url: 'https://solflare.com/download' },
    { name: 'Backpack', url: 'https://backpack.app/download' },
  ],
  evm: [
    { name: 'MetaMask', url: 'https://metamask.io/download' },
    { name: 'Rabby', url: 'https://rabby.io' },
    { name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet/downloads' },
  ],
}

/** Pasa un mensaje de error de wallet a "el usuario canceló" cuando corresponde — cada marca lo dice distinto. */
export function isUserRejection(e: unknown): boolean {
  const err = e as { code?: number; message?: string }
  if (err?.code === 4001) return true
  return /user rejected|rejected the request|user denied|cancel|declined|closed/i.test(err?.message ?? '')
}
