'use client'

import { useState } from 'react'
import { AtSign, KeyRound, LogIn, UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CabalWordmark } from '@/components/cabal/shared'
import { useLogin, useRegister } from '@/lib/api-client'
import { useUI } from '@/lib/store'

export type AuthMode = 'login' | 'register'

/**
 * Diálogo de Iniciar sesión / Crear cuenta (credenciales: usuario + contraseña).
 * Al entrar, toda la app cambia a esa cuenta (puntos, hypes, perfil).
 */
export function AuthDialog() {
  const { authOpen, setAuthOpen, authMode, setAuthMode } = useUI()
  const login = useLogin()
  const register = useRegister()
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  const isLogin = authMode === 'login'
  const pending = login.isPending || register.isPending

  const close = (open: boolean) => {
    setAuthOpen(open)
    if (!open) {
      setPassword('')
      setHandle('')
      setName('')
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
        { handle: handle.trim(), name: name.trim() || undefined, password },
        { onSuccess: () => close(false) }
      )
    }
  }

  return (
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

          <form onSubmit={submit} className="mt-4 space-y-3.5" aria-label={isLogin ? 'Iniciar sesión' : 'Crear cuenta'}>
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
  )
}
