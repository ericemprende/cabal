'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CabalWordmark } from '@/components/cabal/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminPanel } from '@/components/cabal/admin-panel'
import { jsonFetch } from '@/lib/api-client'

type SessionDTO = { authenticated: boolean }

const SESSION_KEY = ['admin', 'session'] as const

export default function AdminPage() {
  const session = useQuery<SessionDTO>({
    queryKey: SESSION_KEY,
    queryFn: () => jsonFetch<SessionDTO>('/api/admin/session'),
    retry: false,
  })

  if (session.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0b08]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
          <p className="text-xs text-muted-foreground">Verificando sesión…</p>
        </div>
      </main>
    )
  }

  return session.data?.authenticated ? <AdminDashboard /> : <AdminLogin />
}

// ---------------- Login ----------------
function AdminLogin() {
  const qc = useQueryClient()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation({
    mutationFn: (data: { user: string; password: string }) =>
      jsonFetch<{ ok: boolean }>('/api/admin/login', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SESSION_KEY })
      toast.success('Sesión iniciada')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user.trim() || !password) {
      toast.error('Completa usuario y contraseña')
      return
    }
    login.mutate({ user, password })
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0b08] px-4">
      {/* Glow verde sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, #8FA83F 0%, transparent 65%)' }}
      />
      <div className="relative w-full max-w-sm">
        {/* Logo de la plataforma */}
        <div className="mb-5 flex justify-center">
          <Link href="/app" aria-label="Ir a la app" className="cursor-pointer transition-opacity hover:opacity-80">
            <CabalWordmark className="h-14 sm:h-16" />
          </Link>
        </div>
        <h1 className="font-machina text-glow text-center text-4xl font-bold tracking-[0.35em] text-primary">
          CABAL
        </h1>
        <p className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Panel admin
        </p>
        <form
          onSubmit={submit}
          className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-[#121410] p-6"
          aria-label="Inicio de sesión del panel"
        >
          <div className="space-y-1.5">
            <Label htmlFor="admin-user" className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Usuario
            </Label>
            <Input
              id="admin-user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              placeholder="admin"
              className="h-10 border-white/10 bg-[#0a0b08] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Contraseña
            </Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10 border-white/10 bg-[#0a0b08] text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={login.isPending}
            className="h-11 w-full gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-[#8FA83F]"
          >
            {login.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" aria-hidden /> Entrar al panel
              </>
            )}
          </Button>
        </form>
      </div>
    </main>
  )
}

// ---------------- Panel a página completa ----------------
function AdminDashboard() {
  const qc = useQueryClient()

  const logout = useMutation({
    mutationFn: () => jsonFetch<{ ok: boolean }>('/api/admin/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SESSION_KEY })
      toast.success('Sesión cerrada')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0b08]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0b08]/95 backdrop-blur">
        <div className="flex h-14 w-full items-center justify-between gap-3 px-4 sm:px-6">
          <p className="flex min-w-0 items-center gap-2.5">
            <Link href="/app" aria-label="Ir a la app" className="shrink-0 cursor-pointer transition-opacity hover:opacity-80">
              <CabalWordmark size="sm" />
            </Link>
            <span className="font-machina truncate text-sm font-bold uppercase tracking-[0.25em] text-muted-foreground">
              · Panel Admin
            </span>
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="h-8 gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Salir
          </Button>
        </div>
      </header>

      <main className="min-h-[calc(100vh-3.5rem)] w-full flex-1 sm:p-4">
        <div className="min-h-[calc(100vh-3.5rem)] border border-white/10 bg-[#121410] sm:min-h-[calc(100vh-4.5rem)] sm:overflow-hidden sm:rounded-2xl">
          <AdminPanel enabled stickyHeader={false} />
        </div>
      </main>
    </div>
  )
}
