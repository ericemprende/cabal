import bs58 from 'bs58'
import { VersionedTransaction, type Transaction } from '@solana/web3.js'

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
type SignTransactionFeature = {
  signTransaction: (
    ...inputs: { account: StdAccount; chain: string; transaction: Uint8Array }[]
  ) => Promise<readonly { signedTransaction: Uint8Array }[]>
}
type SignMessageFeature = {
  signMessage: (...inputs: { account: StdAccount; message: Uint8Array }[]) => Promise<readonly { signature: Uint8Array }[]>
}
type EventsFeature = {
  on: (event: 'change', listener: (props: { accounts?: readonly StdAccount[] }) => void) => () => void
}

const SOLANA_MAINNET = 'solana:mainnet'

const stdWallets = new Set<StdWallet>()

/** Lado "app" del protocolo Wallet Standard (lo mismo que hace @wallet-standard/app). */
function startWalletStandard() {
  const api = Object.freeze({
    register(...wallets: StdWallet[]) {
      wallets.forEach((w) => {
        stdWallets.add(w)
        watchAccounts(w)
      })
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

/**
 * Sigue a la wallet cuando la persona cambia de cuenta dentro de la propia
 * extensión (Phantom, Solflare…) con la página abierta. Sin esto Cabal seguía
 * con la cuenta de antes y cada firma fallaba con "la cuenta conectada ya no
 * está en la wallet" hasta recargar.
 */
function watchAccounts(w: StdWallet) {
  const events = w.features['standard:events'] as EventsFeature | undefined
  if (!events?.on) return
  try {
    events.on('change', ({ accounts }) => {
      const c = connected.solana
      if (!accounts || !c || c.walletId !== w.name) return
      if (accounts.some((a) => a.address === c.address)) return
      const next = accounts.find((a) => a.chains.includes(SOLANA_MAINNET)) ?? accounts[0]
      connected.solana = next ? { walletId: c.walletId, address: next.address } : null
      emit()
    })
  } catch {
    // una wallet que no emite eventos se sigue pudiendo usar reconectando
  }
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
  void startMobileWalletAdapter()
}

/**
 * Mobile Wallet Adapter (Solana Mobile): en Android, también dentro de la app
 * TWA del Seeker, no hay extensiones; MWA se anuncia como una wallet estándar
 * más ("Mobile Wallet Adapter") y abre la wallet instalada en el teléfono
 * (Seed Vault, Phantom, Solflare…) para conectar y firmar sin salir de Cabal.
 * Se carga solo en Android para no sumar peso al escritorio.
 */
export const MWA_WALLET_NAME = 'Mobile Wallet Adapter'

async function startMobileWalletAdapter() {
  if (!/android/i.test(navigator.userAgent)) return
  skipLoopbackPermissionModal()
  try {
    const mwa = await import('@solana-mobile/wallet-standard-mobile')
    mwa.registerMwa({
      appIdentity: {
        name: 'Cabal',
        uri: window.location.origin,
        icon: '/icons/icon-192.png',
      },
      authorizationCache: mwa.createDefaultAuthorizationCache(),
      chains: [SOLANA_MAINNET],
      chainSelector: mwa.createDefaultChainSelector(),
      onWalletNotFound: mwa.createDefaultWalletNotFoundHandler(),
    })
  } catch {
    // sin MWA quedan los enlaces para abrir Cabal dentro de la wallet
  }
}

/**
 * MWA 0.6 pregunta el permiso "loopback-network" (Acceso a la red local de
 * Chrome) y, si está en "prompt", enseña su aviso "Allow connection…" y espera
 * a que Chrome muestre la ventana de permitir. Dentro de la TWA esa ventana
 * nunca sale y la app se queda congelada. Respondemos "granted" para que MWA
 * vaya directo al websocket local: si Chrome lo bloquea, falla con error en
 * vez de colgarse.
 */
function skipLoopbackPermissionModal() {
  const perms = navigator.permissions
  if (!perms?.query) return
  const original = perms.query.bind(perms)
  try {
    perms.query = ((desc: PermissionDescriptor) => {
      if ((desc as { name: string }).name === 'loopback-network') {
        return Promise.resolve({ state: 'granted', onchange: null } as unknown as PermissionStatus)
      }
      return original(desc)
    }) as Permissions['query']
  } catch {
    // navegador que no deja sobrescribir query: queda el flujo normal de MWA
  }
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

/**
 * MWA abre la wallet con un intent, y Chrome solo deja lanzarlo justo después
 * de un toque. Conectar y luego firmar en la misma pulsación abre la wallet
 * dos veces: la segunda se pierde y Solflare se abre sin pedir nada. Con MWA
 * cada apertura de la wallet necesita su propio toque.
 */
export function isMwaConnected(): boolean {
  return connected.solana?.walletId === MWA_WALLET_NAME
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
    const res = await withTimeout((w.features['standard:connect'] as ConnectFeature).connect(), 120_000)
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
  let account = wallet.accounts.find((a) => a.address === c.address)
  if (!account) {
    // Se cambió de cuenta en la extensión y el aviso no llegó: se sigue con la
    // que la wallet tiene ahora en vez de bloquear hasta recargar
    account = wallet.accounts.find((a) => a.chains.includes(SOLANA_MAINNET)) ?? wallet.accounts[0]
    if (!account) throw new Error('La wallet no tiene ninguna cuenta conectada; vuelve a conectar')
    connected.solana = { walletId: c.walletId, address: account.address }
    emit()
  }
  return { wallet, account }
}

/**
 * Espera a la wallet como mucho `ms`. Si su ventana se cierra sin rechazar
 * (pasa a veces), la promesa quedaba colgada para siempre y el botón girando.
 */
function withTimeout<T>(p: Promise<T>, ms = 180_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('La wallet no respondió. Ábrela y vuelve a intentarlo.')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

/** Firma y manda una transacción con la wallet de Solana conectada. Devuelve la firma en base58. */
export async function solanaSignAndSend(tx: Transaction | VersionedTransaction): Promise<string> {
  const { wallet, account } = solanaAccount()
  const bytes =
    'version' in tx ? tx.serialize() : tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  const [out] = await withTimeout(
    (wallet.features['solana:signAndSendTransaction'] as SignAndSendFeature).signAndSendTransaction({
      account,
      chain: SOLANA_MAINNET,
      transaction: bytes,
    }),
  )
  return bs58.encode(out.signature)
}

/**
 * Firma transacciones con la wallet de Solana conectada SIN mandarlas, para
 * las que llevan otro firmante más (el mint al lanzar un token): la wallet
 * firma primero y el resto después, que es lo que piden Phantom y compañía.
 * Todas en una sola llamada, así la wallet pide una única aprobación.
 */
export async function solanaSignTransactions(txs: VersionedTransaction[]): Promise<VersionedTransaction[]> {
  const { wallet, account } = solanaAccount()
  const feature = wallet.features['solana:signTransaction'] as SignTransactionFeature | undefined
  if (!feature) throw new Error(`${wallet.name} no permite firmar transacciones`)
  const out = await withTimeout(
    feature.signTransaction(...txs.map((tx) => ({ account, chain: SOLANA_MAINNET, transaction: tx.serialize() }))),
  )
  return out.map((o) => VersionedTransaction.deserialize(o.signedTransaction))
}

/** Firma un mensaje con la wallet de Solana conectada. Devuelve la firma en base58. */
export async function solanaSignMessage(message: Uint8Array): Promise<string> {
  const { wallet, account } = solanaAccount()
  const feature = wallet.features['solana:signMessage'] as SignMessageFeature | undefined
  if (!feature) throw new Error(`${wallet.name} no permite firmar mensajes`)
  const [out] = await withTimeout(feature.signMessage({ account, message }))
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
