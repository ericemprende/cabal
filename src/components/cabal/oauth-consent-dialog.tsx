'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, X as CloseIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useVerifyProvider } from '@/lib/api-client'

/**
 * Pantalla de consentimiento simulada (modo demo, sin API keys).
 * Imita la pantalla real de autorización del proveedor para que el flujo se
 * sienta idéntico. En producción, con las API keys configuradas, el usuario
 * es redirigido a la pantalla real de X / Google vía OAuth 2.0.
 */
export function OAuthConsentDialog({
  provider,
  appName,
  onOpenChange,
}: {
  provider: 'x' | 'google' | null
  appName: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={provider !== null} onOpenChange={onOpenChange}>
      {provider === 'x' && (
        <DialogContent className="border-white/10 bg-black p-0 sm:max-w-md" aria-describedby={undefined}>
          <XConsent appName={appName} onOpenChange={onOpenChange} />
        </DialogContent>
      )}
      {provider === 'google' && (
        <DialogContent className="border-white/10 bg-white p-0 text-zinc-900 sm:max-w-md" aria-describedby={undefined}>
          <GoogleConsent appName={appName} onOpenChange={onOpenChange} />
        </DialogContent>
      )}
    </Dialog>
  )
}

function XConsent({
  appName,
  onOpenChange,
}: {
  appName: string
  onOpenChange: (open: boolean) => void
}) {
  const verify = useVerifyProvider()
  const [handle, setHandle] = useState('')

  useEffect(() => {
    if (verify.isSuccess) onOpenChange(false)
  }, [verify.isSuccess, onOpenChange])

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-start justify-between">
        <XLogo className="h-8 w-8 text-white" />
        <button
          onClick={() => onOpenChange(false)}
          className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Cerrar"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <DialogTitle className="mt-6 text-2xl font-extrabold text-white">Autorizar {appName}</DialogTitle>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Autorizarás a <span className="font-bold text-white">{appName}</span> a leer tu perfil
        público de X: tu nombre y tu @usuario. Así tu calls quedan firmados con identidad verificada.
      </p>

      <div className="mt-5 space-y-2">
        <label htmlFor="x-handle-demo" className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Cuenta de X
        </label>
        <Input
          id="x-handle-demo"
          autoFocus
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@tu_usuario"
          className="h-11 border-white/15 bg-zinc-950 text-white placeholder:text-zinc-600"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && handle.trim()) verify.mutate({ provider: 'x', value: handle.trim() })
          }}
        />
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-400">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
        Pantalla simulada · configura <span className="mx-1 font-mono text-zinc-200">X_CLIENT_ID</span> para el
        OAuth real
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="h-11 flex-1 rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
        >
          Cancelar
        </Button>
        <Button
          disabled={!handle.trim() || verify.isPending}
          onClick={() => verify.mutate({ provider: 'x', value: handle.trim() })}
          className="h-11 flex-1 rounded-full bg-white font-bold text-black hover:bg-zinc-200"
        >
          {verify.isPending ? 'Conectando…' : 'Autorizar'}
        </Button>
      </div>
    </div>
  )
}

function GoogleConsent({
  appName,
  onOpenChange,
}: {
  appName: string
  onOpenChange: (open: boolean) => void
}) {
  const verify = useVerifyProvider()
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (verify.isSuccess) onOpenChange(false)
  }, [verify.isSuccess, onOpenChange])

  return (
    <div className="px-6 py-8 sm:px-10">
      <div className="flex justify-center">
        <GoogleG className="h-9 w-9" />
      </div>
      <DialogTitle className="mt-4 text-center font-['Roboto'] text-2xl font-normal">
        Acceder con Google
      </DialogTitle>
      <p className="mt-2 text-center text-sm text-zinc-600">
        Para continuar con <span className="font-medium text-zinc-900">{appName}</span>, confirma tu
        cuenta de Google. Tu email queda verificado en tu perfil.
      </p>

      <div className="mt-6 space-y-2">
        <label htmlFor="g-email-demo" className="text-xs font-medium text-zinc-600">
          Correo electrónico
        </label>
        <Input
          id="g-email-demo"
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@gmail.com"
          className="h-11 border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && email.trim()) verify.mutate({ provider: 'google', value: email.trim() })
          }}
        />
      </div>

      <div className="mt-5 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-[11px] text-zinc-500">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Pantalla simulada · configura <span className="mx-1 font-mono text-zinc-700">GOOGLE_CLIENT_ID</span> para el
        OAuth real
      </div>

      <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="h-10 rounded-full border-zinc-300 bg-transparent px-6 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancelar
        </Button>
        <Button
          disabled={!email.trim() || verify.isPending}
          onClick={() => verify.mutate({ provider: 'google', value: email.trim() })}
          className="h-10 rounded-full bg-[#1a73e8] px-6 text-[13px] font-medium text-white hover:bg-[#1765cc]"
        >
          {verify.isPending ? 'Conectando…' : 'Siguiente'}
        </Button>
      </div>
    </div>
  )
}

// ---------- Logos de marca ----------
export function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  )
}
