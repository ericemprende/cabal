'use client'

import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { ExternalLink, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLang } from '@/lib/i18n/provider'
import { baseLang } from '@/lib/i18n/config'
import {
  connectWallet,
  connectedWallet,
  isUserRejection,
  lastUsedWallet,
  listWallets,
  subscribeWallets,
  SUGGESTED_WALLETS,
  walletsVersion,
  type WalletFamily,
} from '@/lib/wallets'

// Textos propios del selector (los diccionarios globales los edita otra tanda de trabajo en paralelo).
const TEXT = {
  es: {
    title: 'Conecta tu wallet',
    solana: 'Elige con qué wallet de Solana quieres operar.',
    evm: 'Elige con qué wallet EVM quieres operar.',
    last: 'Última usada',
    none: 'No encontramos ninguna wallet instalada en este navegador. Instala una y recarga la página:',
    failed: 'No se pudo conectar la wallet',
  },
  en: {
    title: 'Connect your wallet',
    solana: 'Choose which Solana wallet to trade with.',
    evm: 'Choose which EVM wallet to trade with.',
    last: 'Last used',
    none: "We couldn't find any wallet installed in this browser. Install one and reload the page:",
    failed: "Couldn't connect the wallet",
  },
}

const serverVersion = () => 0

/** Se re-renderiza cuando aparece una wallet nueva o cambia la conectada. */
export function useWalletsVersion(): number {
  return useSyncExternalStore(subscribeWallets, walletsVersion, serverVersion)
}

/** Dirección conectada en esta página para esa familia de redes (compartida por todos los botones). */
export function useConnectedAddress(family: WalletFamily): string | null {
  useWalletsVersion()
  return typeof window === 'undefined' ? null : (connectedWallet(family)?.address ?? null)
}

/**
 * `requestWallet()` devuelve la dirección de la wallet ya conectada o, si no
 * hay, abre el selector y espera a que la persona elija y apruebe la
 * conexión (null si cierra el selector o rechaza). `picker` hay que
 * renderizarlo en algún lado del componente.
 */
export function useWalletPicker(family: WalletFamily) {
  const [open, setOpen] = useState(false)
  const resolver = useRef<((address: string | null) => void) | null>(null)

  const finish = useCallback((address: string | null) => {
    resolver.current?.(address)
    resolver.current = null
    setOpen(false)
  }, [])

  const requestWallet = useCallback(
    (opts?: { forcePicker?: boolean }): Promise<string | null> => {
      const current = connectedWallet(family)
      if (current && !opts?.forcePicker) return Promise.resolve(current.address)
      resolver.current?.(null)
      setOpen(true)
      return new Promise((resolve) => {
        resolver.current = resolve
      })
    },
    [family]
  )

  const picker = <WalletPickerDialog family={family} open={open} onDone={finish} />
  return { requestWallet, picker }
}

function WalletPickerDialog({
  family,
  open,
  onDone,
}: {
  family: WalletFamily
  open: boolean
  onDone: (address: string | null) => void
}) {
  const [lang] = useLang()
  const tx = TEXT[baseLang(lang)]
  useWalletsVersion()
  const wallets = open ? listWallets(family) : []
  const last = open ? lastUsedWallet(family) : null
  const [connecting, setConnecting] = useState<string | null>(null)

  const pick = async (id: string) => {
    setConnecting(id)
    try {
      onDone(await connectWallet(family, id))
    } catch (e) {
      if (!isUserRejection(e)) toast.error(tx.failed, { description: (e as Error)?.message?.slice(0, 140) })
    } finally {
      setConnecting(null)
    }
  }

  // La última usada primero
  const sorted = [...wallets].sort((a, b) => Number(b.id === last) - Number(a.id === last))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDone(null)}>
      <DialogContent
        // Los portales de React propagan los clics al árbol padre: sin esto, un
        // clic aquí llegaría a la fila del token que contiene el botón de compra.
        onClick={(e) => e.stopPropagation()}
        className="max-w-sm border-white/10 bg-[#121410]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" aria-hidden />
            {tx.title}
          </DialogTitle>
          <DialogDescription>{family === 'solana' ? tx.solana : tx.evm}</DialogDescription>
        </DialogHeader>

        {sorted.length > 0 ? (
          <ul className="space-y-1.5">
            {sorted.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => pick(w.id)}
                  disabled={!!connecting}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2.5 text-left text-sm font-bold transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
                >
                  {w.icon ? (
                    <img src={w.icon} alt="" className="h-7 w-7 rounded-md" />
                  ) : (
                    <Wallet className="h-7 w-7 p-1 text-muted-foreground" aria-hidden />
                  )}
                  <span className="flex-1">{w.name}</span>
                  {connecting === w.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    w.id === last && <span className="text-[10px] font-medium text-muted-foreground">{tx.last}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{tx.none}</p>
            <ul className="space-y-1.5">
              {SUGGESTED_WALLETS[family].map((s) => (
                <li key={s.name}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2.5 text-sm font-bold hover:border-primary/50"
                  >
                    {s.name}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
