'use client'

import { useState } from 'react'
import { AtSign, Gift, KeyRound, LogIn, UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CabalWordmark } from '@/components/cabal/shared'
import { OAuthConsentDialog, XLogo, GoogleG } from '@/components/cabal/oauth-consent-dialog'
import { useAuthStatus, useLogin, useRegister } from '@/lib/api-client'
import { useUI } from '@/lib/store'

export type AuthMode = 'login' | 'register'

/**
 * Diálogo de Iniciar sesión / Crear cuenta.
 * - Login social directo con X o Google (con API keys → OAuth real;
 *   sin keys → consentimiento simulado que crea/entra con esa identidad).
 * - O credenciales: usuario + contraseña.
 * Al entrar, toda la app cambia a esa cuenta (puntos, hypes, perfil).
 */
export function AuthDialog() {
  const { authOpen, setAuthOpen, authMode, setAuthMode } = useUI()
  const login = useLogin()
  const register = useRegister()
  const { data: authStatus } = useAuthStatus()
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [demoProvider, setDemoProvider] = useState<'x' | 'google' | null>(null)

  const isLogin = authMode === 'login'
  const pending = login.isPending || register.isPending

  const close = (open: boolean) => {
    setAuthOpen(open)
    if (!open) {
      setPassword('')
      setHandle('')
      setName('')
      setReferralCode('')
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!handle.trim() || !password) return
    if (isLogin) {
      login.mutate(
        { handle: handle.trim(), password },
        { onSuccess: () => close(false) }
      )
    } else {
      register.mutate(
        {
          handle: handle.trim(),
          name: name.trim() || undefined,
          password,
          referralCode: referralCode.trim() || undefined,
        },
        { onSuccess: () => close(false) }
      )
    }
  }

  // Login social: con API keys → OAuth real por redirección; sin keys → consentimiento demo
  const startSocial = (provider: 'x' | 'google') => {
    const configured = provider === 'x' ? authStatus?.x.configured : authStatus?.google.configured
    if (configured) {
      window.location.assign(`/api/auth/${provider}/start?mode=login`)
    } else {
      setDemoProvider(provider)
    }
  }

  return (
    <>
    <Dialog open={authOpen} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-sm" aria-describedby={undefined}>
        <div className="p-6">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <CabalWordmark size="lg" />
            <DialogTitle className="sr-only">{isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isLogin
                ? 'Entra para guardar tus puntos, hypes y launches'
                : 'Crea tu cuenta del Cabal y empieza a acumular puntos para el airdrop'}
            </DialogDescription>
          </div>

          {/* Tabs */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#0a0b08] p-1">
            {(
              [
                { key: 'login' as const, label: 'Iniciar sesión', icon: LogIn },
                { key: 'register' as const, label: 'Crear cuenta', icon: UserPlus },
              ]
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setAuthMode(t.key)}
                aria-pressed={authMode === t.key}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all',
                  authMode === t.key
                    ? 'bg-[#8FA83F]/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <t.icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>

          {/* Login social directo con X / Google */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => startSocial('x')}
              className="h-10 gap-2 rounded-xl border-white/12 bg-[#0a0b08] text-[13px] font-bold text-foreground hover:border-white/25 hover:bg-white/5"
            >
              <XLogo className="h-3.5 w-3.5" aria-hidden />
              X
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => startSocial('google')}
              className="h-10 gap-2 rounded-xl border-white/12 bg-[#0a0b08] text-[13px] font-bold text-foreground hover:border-white/25 hover:bg-white/5"
            >
              <GoogleG className="h-4 w-4" aria-hidden />
              Google
            </Button>
          </div>

          <div className="my-4 flex items-center gap-3" role="separator" aria-label="o con tus credenciales">
            <span className="h-px flex-1 bg-white/8" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">o con tu usuario</span>
            <span className="h-px flex-1 bg-white/8" />
          </div>

          <form onSubmit={submit} className="space-y-3.5" aria-label={isLogin ? 'Iniciar sesión' : 'Crear cuenta'}>
            <div className="space-y-1.5">
              <Label htmlFor="auth-handle" className="text-xs text-muted-foreground">Usuario</Label>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a0b08] pl-3 focus-within:border-[#8FA83F]/40">
                <AtSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  id="auth-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="tunombre"
                  autoComplete="username"
                  className="h-10 border-0 bg-transparent px-0 font-mono text-sm focus-visible:ring-0"
                  required
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name" className="text-xs text-muted-foreground">Nombre (opcional)</Label>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cómo te ven en el Cabal"
                  autoComplete="name"
                  className="h-10 border-white/10 bg-[#0a0b08] text-sm"
                />
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-referral" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gift className="h-3.5 w-3.5" aria-hidden /> Código de invitación (opcional)
                </Label>
                <Input
                  id="auth-referral"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="CABAL-XXXXXX"
                  className="h-10 border-white/10 bg-[#0a0b08] font-mono text-sm uppercase tracking-wider"
                />
                <p className="text-[10px] text-muted-foreground/70">Quien te invitó gana puntos por tu actividad.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="auth-password" className="text-xs text-muted-foreground">Contraseña</Label>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a0b08] pl-3 focus-within:border-[#8FA83F]/40">
                <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  minLength={6}
                  className="h-10 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                  required
                />
              </div>
              {!isLogin && (
                <p className="text-[10px] text-muted-foreground/70">Mínimo 6 caracteres.</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={pending || !handle.trim() || !password}
              className="h-10 w-full gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-[#8FA83F]"
            >
              {pending ? 'Conectando…' : isLogin ? 'Iniciar sesión' : 'Crear mi cuenta'}
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70">
            {isLogin ? (
              <>
                ¿Sin cuenta?{' '}
                <button type="button" onClick={() => setAuthMode('register')} className="font-semibold text-primary hover:underline">
                  Regístrate gratis
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{' '}
                <button type="button" onClick={() => setAuthMode('login')} className="font-semibold text-primary hover:underline">
                  Inicia sesión
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>

    {/* Consentimiento social simulado (modo demo, sin API keys) */}
    <OAuthConsentDialog
      mode="login"
      provider={demoProvider}
      appName="Cabal"
      onOpenChange={(o) => !o && setDemoProvider(null)}
    />
    </>
  )
}
