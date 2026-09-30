'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, AtSign, Gift, KeyRound, LogIn, Mail, UserPlus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
import { CabalWordmark } from '@/components/cabal/shared'
import { OAuthConsentDialog, XLogo, GoogleG } from '@/components/cabal/oauth-consent-dialog'
import { jsonFetch, useAuthStatus, useLogin, useRegister } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { startOAuth } from '@/lib/native-bridge'

export type AuthMode = 'login' | 'register'

const REF_KEY = 'cabal_ref'

/**
 * Diálogo de Iniciar sesión / Crear cuenta.
 * - Login social directo con X o Google (con API keys → OAuth real;
 *   sin keys → consentimiento simulado que crea/entra con esa identidad).
 * - O credenciales: usuario + contraseña.
 * Al entrar, toda la app cambia a esa cuenta (puntos, hypes, perfil).
 */
export function AuthDialog() {
  const t = useT()
  const { authOpen, setAuthOpen, authMode, setAuthMode } = useUI()
  const login = useLogin()
  const register = useRegister()
  const setWelcomeShareOpen = useUI((s) => s.setWelcomeShareOpen)
  const { data: authStatus } = useAuthStatus()
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [demoProvider, setDemoProvider] = useState<'x' | 'google' | null>(null)
  const [forgot, setForgot] = useState(false)
  const [challenge, setChallenge] = useState<{ id: string; hint: string } | null>(null)

  // Enlace de invitación (/app?ref=CODIGO): se guarda para prellenar el registro
  // aunque el visitante tarde en abrir el diálogo o recargue la página.
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase()
      if (fromUrl && /^[A-Z0-9]{4,12}$/.test(fromUrl)) localStorage.setItem(REF_KEY, fromUrl)
    } catch {}
  }, [])
  useEffect(() => {
    if (!authOpen) return
    try {
      const saved = localStorage.getItem(REF_KEY)
      if (saved) setReferralCode((c) => c || saved)
    } catch {}
  }, [authOpen])

  const isLogin = authMode === 'login'
  const pending = login.isPending || register.isPending

  const close = (open: boolean) => {
    setAuthOpen(open)
    if (!open) {
      setForgot(false)
      setChallenge(null)
      setPassword('')
      setHandle('')
      setName('')
      setEmail('')
      setReferralCode('')
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLogin) {
      if (!handle.trim() || !password) return
      login.mutate(
        { handle: handle.trim(), password },
        {
          onSuccess: (res) => {
            if (res.twoFactor) setChallenge({ id: res.challengeId, hint: res.emailHint })
            else close(false)
          },
        }
      )
    } else {
      if (!handle.trim() || !password || !email.trim()) return
      register.mutate(
        {
          handle: handle.trim(),
          name: name.trim() || undefined,
          email: email.trim(),
          password,
          referralCode: referralCode.trim() || undefined,
        },
        {
          onSuccess: () => {
            close(false)
            setWelcomeShareOpen(true)
          },
        }
      )
    }
  }

  // Login social: con API keys → OAuth real por redirección; sin keys → consentimiento
  // demo, que el servidor solo admite en desarrollo (en producción el botón no sale)
  const startSocial = (provider: 'x' | 'google') => {
    if (authStatus?.[provider].configured) {
      void startOAuth(provider, 'login')
    } else if (authStatus?.[provider].demo) {
      setDemoProvider(provider)
    }
  }
  const socialProviders = (['x', 'google'] as const).filter(
    (p) => authStatus?.[p].configured || authStatus?.[p].demo
  )

  return (
    <>
    <Dialog open={authOpen} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-sm" aria-describedby={undefined}>
        <div className="p-6">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <CabalWordmark size="lg" />
            <DialogTitle className="sr-only">{isLogin ? t.auth.login : t.auth.register}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isLogin ? t.auth.loginLead : t.auth.registerLead}
            </DialogDescription>
          </div>

          {challenge ? (
            <TwoFactorStep
              challenge={challenge}
              onChallenge={setChallenge}
              onBack={() => setChallenge(null)}
              onDone={() => close(false)}
            />
          ) : forgot ? (
            <ForgotPassword initial={handle} onBack={() => setForgot(false)} onDone={() => close(false)} />
          ) : (
          <>
          {/* Tabs */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#0a0b08] p-1">
            {(
              [
                { key: 'login' as const, label: t.auth.login, icon: LogIn },
                { key: 'register' as const, label: t.auth.register, icon: UserPlus },
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

          {/* Login social directo con X / Google (solo los proveedores disponibles) */}
          {socialProviders.length > 0 && (
            <>
              <div className={cn('mt-4 grid gap-2', socialProviders.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                {socialProviders.includes('x') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => startSocial('x')}
                    className="gap-2 border-white/12 bg-[#0a0b08] text-[13px] font-bold text-foreground hover:border-white/25 hover:bg-white/5"
                  >
                    <XLogo className="h-3.5 w-3.5" aria-hidden />
                    X
                  </Button>
                )}
                {socialProviders.includes('google') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => startSocial('google')}
                    className="gap-2 border-white/12 bg-[#0a0b08] text-[13px] font-bold text-foreground hover:border-white/25 hover:bg-white/5"
                  >
                    <GoogleG className="h-4 w-4" aria-hidden />
                    Google
                  </Button>
                )}
              </div>

              <div className="my-4 flex items-center gap-3" role="separator" aria-label={t.auth.orCredentials}>
                <span className="h-px flex-1 bg-white/8" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {t.auth.orUser}
                </span>
                <span className="h-px flex-1 bg-white/8" />
              </div>
            </>
          )}

          <form
            onSubmit={submit}
            className={cn('space-y-3.5', socialProviders.length === 0 && 'mt-4')}
            aria-label={isLogin ? t.auth.login : t.auth.register}
          >
            <div className="space-y-1.5">
              <Label htmlFor="auth-handle" className="text-xs text-muted-foreground">{t.auth.user}</Label>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a0b08] pl-3 focus-within:border-[#8FA83F]/40">
                <AtSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  id="auth-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder={t.auth.userPlaceholder}
                  autoComplete="username"
                  className="h-10 border-0 bg-transparent px-0 font-mono text-base focus-visible:ring-0 sm:text-sm"
                  required
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name" className="text-xs text-muted-foreground">{t.auth.name}</Label>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.auth.namePlaceholder}
                  autoComplete="name"
                  className="h-10 border-white/10 bg-[#0a0b08] text-base sm:text-sm"
                />
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-xs text-muted-foreground">{t.auth.email}</Label>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a0b08] pl-3 focus-within:border-[#8FA83F]/40">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <Input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.auth.emailPlaceholder}
                    autoComplete="email"
                    className="h-10 border-0 bg-transparent px-0 text-base focus-visible:ring-0 sm:text-sm"
                    required
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-referral" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gift className="h-3.5 w-3.5" aria-hidden /> {t.auth.referral}
                </Label>
                <Input
                  id="auth-referral"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="CABAL-XXXXXX"
                  className="h-10 border-white/10 bg-[#0a0b08] font-mono text-base uppercase tracking-wider sm:text-sm"
                />
                <p className="text-[10px] text-muted-foreground/70">{t.auth.referralHint}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="auth-password" className="text-xs text-muted-foreground">{t.auth.password}</Label>
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
                  className="h-10 border-0 bg-transparent px-0 text-base focus-visible:ring-0 sm:text-sm"
                  required
                />
              </div>
              {!isLogin && (
                <p className="text-[10px] text-muted-foreground/70">{t.auth.passwordHint}</p>
              )}
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setForgot(true)}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-primary hover:underline"
                >
                  {t.auth.forgot}
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={pending || !handle.trim() || !password || (!isLogin && !email.trim())}
              className="w-full gap-2 text-sm font-bold"
            >
              {pending ? t.auth.connecting : isLogin ? t.auth.login : t.auth.createAccount}
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70">
            {isLogin ? (
              <>
                {t.auth.noAccount}{' '}
                <button type="button" onClick={() => setAuthMode('register')} className="font-semibold text-primary hover:underline">
                  {t.auth.registerFree}
                </button>
              </>
            ) : (
              <>
                {t.auth.haveAccount}{' '}
                <button type="button" onClick={() => setAuthMode('login')} className="font-semibold text-primary hover:underline">
                  {t.auth.signIn}
                </button>
              </>
            )}
          </p>
          </>
          )}
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

/**
 * Recuperar la contraseña en dos pasos: pedir un código al correo verificado
 * (usuario o correo) y, con el código, poner una contraseña nueva. Al acabar
 * queda la sesión iniciada.
 */
function ForgotPassword({ initial, onBack, onDone }: { initial: string; onBack: () => void; onDone: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [identifier, setIdentifier] = useState(initial)
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const request = async () => {
    if (!identifier.trim()) return
    setBusy(true)
    try {
      await jsonFetch('/api/auth/password/forgot', { method: 'POST', body: JSON.stringify({ identifier: identifier.trim() }) })
      setSent(true)
      toast.success(t.auth.codeSent)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    setBusy(true)
    try {
      await jsonFetch('/api/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), code, password }),
      })
      qc.invalidateQueries()
      toast.success(t.auth.passwordChanged)
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (sent) void reset()
    else void request()
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3.5" aria-label={t.auth.forgotTitle}>
      <div>
        <h3 className="text-sm font-bold">{t.auth.forgotTitle}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{sent ? t.auth.codeSent : t.auth.forgotLead}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="forgot-id" className="text-xs text-muted-foreground">{t.auth.identifier}</Label>
        <Input
          id="forgot-id"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          disabled={sent}
          className="h-10 border-white/10 bg-[#0a0b08] text-base sm:text-sm"
          required
        />
      </div>

      {sent && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="forgot-code" className="text-xs text-muted-foreground">{t.auth.code}</Label>
            <Input
              id="forgot-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="h-10 border-white/10 bg-[#0a0b08] text-center font-mono text-lg tracking-[0.4em]"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forgot-pass" className="text-xs text-muted-foreground">{t.auth.newPassword}</Label>
            <Input
              id="forgot-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              placeholder="••••••••"
              className="h-10 border-white/10 bg-[#0a0b08] text-base sm:text-sm"
              required
            />
            <p className="text-[10px] text-muted-foreground/70">{t.auth.passwordHint}</p>
          </div>
        </>
      )}

      <Button
        type="submit"
        disabled={busy || !identifier.trim() || (sent && (code.length !== 6 || password.length < 6))}
        className="w-full text-sm font-bold"
      >
        {busy ? t.auth.connecting : sent ? t.auth.changePassword : t.auth.sendCode}
      </Button>

      <div className="flex items-center justify-between text-[11px]">
        <button type="button" onClick={onBack} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" aria-hidden /> {t.auth.backToLogin}
        </button>
        {sent && (
          <button type="button" onClick={() => void request()} disabled={busy} className="font-semibold text-primary hover:underline">
            {t.auth.resend}
          </button>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground/60">{t.auth.noVerifiedEmail}</p>
    </form>
  )
}

/**
 * Segundo paso del login con verificación en dos pasos: el código que llegó al
 * correo. "Reenviar" devuelve un reto nuevo, que sustituye al anterior.
 */
function TwoFactorStep({
  challenge,
  onChallenge,
  onBack,
  onDone,
}: {
  challenge: { id: string; hint: string }
  onChallenge: (c: { id: string; hint: string }) => void
  onBack: () => void
  onDone: () => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return
    setBusy(true)
    try {
      await jsonFetch('/api/auth/2fa', { method: 'POST', body: JSON.stringify({ challengeId: challenge.id, code }) })
      qc.invalidateQueries()
      toast.success('Sesión iniciada')
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setBusy(true)
    try {
      const res = await jsonFetch<{ challengeId: string; emailHint: string }>('/api/auth/2fa', {
        method: 'POST',
        body: JSON.stringify({ challengeId: challenge.id, resend: true }),
      })
      onChallenge({ id: res.challengeId, hint: res.emailHint })
      setCode('')
      toast.success(t.auth.twoFactorResent)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={verify} className="mt-5 space-y-3.5" aria-label={t.auth.twoFactorTitle}>
      <div>
        <h3 className="text-sm font-bold">{t.auth.twoFactorTitle}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t.auth.twoFactorLead(challenge.hint)}</p>
      </div>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        aria-label={t.auth.code}
        autoFocus
        className="h-11 border-white/10 bg-[#0a0b08] text-center font-mono text-lg tracking-[0.4em]"
      />
      <Button type="submit" disabled={busy || code.length !== 6} className="w-full text-sm font-bold">
        {busy ? t.auth.connecting : t.auth.login}
      </Button>
      <div className="flex items-center justify-between text-[11px]">
        <button type="button" onClick={onBack} className="flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" aria-hidden /> {t.auth.backToLogin}
        </button>
        <button type="button" onClick={() => void resend()} disabled={busy} className="font-semibold text-primary hover:underline">
          {t.auth.resend}
        </button>
      </div>
    </form>
  )
}
