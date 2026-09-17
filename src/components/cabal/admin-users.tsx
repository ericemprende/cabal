'use client'

import { useState, type ReactNode } from 'react'
import { Download, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminWaitlist } from '@/lib/api-client'
import { timeAgo } from '@/lib/cabal'
import { cn } from '@/lib/utils'
import type { AdminUserRowDTO } from '@/lib/types'

/**
 * Pestaña "Usuarios" del panel admin. Une la lista de usuarios con la antigua
 * lista de espera: arriba los contadores (registrados, verificados con X y con
 * Google, compartieron, sin terminar) y abajo una sola lista. Quien entró con X
 * por la landing pero no envió el formulario o no llegó a crear cuenta aparece
 * como "sin terminar".
 */

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'x', label: 'Verificados con X' },
  { key: 'google', label: 'Verificados con Google' },
  { key: 'shared', label: 'Compartieron' },
  { key: 'incomplete', label: 'Sin terminar' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

export function AdminUsers({
  enabled,
  users,
  loading,
  renderRow,
}: {
  enabled: boolean
  users: AdminUserRowDTO[] | undefined
  loading: boolean
  renderRow: (user: AdminUserRowDTO, index: number) => ReactNode
}) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [q, setQ] = useState('')
  const waitlist = useAdminWaitlist(enabled, { all: true })

  const all = users ?? []
  const incomplete = (waitlist.data?.entries ?? []).filter((e) => !e.completed || !e.userId)

  const stats = {
    total: all.length,
    x: all.filter((u) => u.xVerified).length,
    google: all.filter((u) => u.googleVerified).length,
    shared: all.filter((u) => u.shared).length,
    incomplete: incomplete.length,
  }

  const needle = q.trim().toLowerCase()
  const match = (...fields: (string | null | undefined)[]) =>
    !needle || fields.some((f) => f?.toLowerCase().includes(needle))

  const shownUsers =
    filter === 'incomplete'
      ? []
      : all.filter(
          (u) =>
            (filter === 'all' ||
              (filter === 'x' && u.xVerified) ||
              (filter === 'google' && u.googleVerified) ||
              (filter === 'shared' && u.shared)) &&
            match(u.handle, u.name, u.xHandle, u.contactEmail)
        )
  const shownIncomplete =
    filter === 'all' || filter === 'incomplete'
      ? incomplete.filter((e) => match(e.xHandle, e.xName, e.email))
      : []

  const isLoading = loading || waitlist.isLoading

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Todas las personas registradas con su correo, verificaciones y si compartieron. Ajusta puntos, edita perfiles
        (X, Telegram, Google) y gestiona insignias y roles. Cada cambio queda registrado.
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Stat label="Registrados" value={stats.total} highlight />
        <Stat label="Verificados X" value={stats.x} />
        <Stat label="Verificados Google" value={stats.google} />
        <Stat label="Compartieron" value={stats.shared} />
        <Stat label="Sin terminar" value={stats.incomplete} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all',
                filter === f.key
                  ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                  : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por @handle, nombre o correo…"
            className="h-9 border-white/10 bg-[#0a0b08] pl-8 text-xs"
            aria-label="Buscar usuarios"
          />
        </div>

        <Button
          asChild
          size="sm"
          variant="ghost"
          className="h-9 gap-1.5 rounded-lg border border-white/10 px-3 text-[11px] font-bold"
        >
          <a href="/api/admin/waitlist/export?all=1" download>
            <Download className="h-3.5 w-3.5" aria-hidden /> CSV registros X
          </a>
        </Button>
      </div>

      {isLoading && [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}

      {shownUsers.map((u, i) => renderRow(u, i + 1))}

      {shownIncomplete.map((e) => (
        <div
          key={e.id}
          className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-white/10 bg-[#0a0b08] p-3"
        >
          {e.xAvatar ? (
            <img src={e.xAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#121410] text-sm">🐺</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
              <a
                href={`https://x.com/${e.xHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-primary"
              >
                @{e.xHandle}
              </a>
              <span className="truncate text-[11px] font-normal text-muted-foreground">{e.xName}</span>
              <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                SIN TERMINAR
              </span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {e.email || 'sin correo'} · {e.xFollowers.toLocaleString('es')} seguidores
              {e.shared ? ' · compartió' : ''} · {timeAgo(e.createdAt)}
            </p>
          </div>
        </div>
      ))}

      {!isLoading && shownUsers.length + shownIncomplete.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-muted-foreground">
          No hay usuarios con ese filtro
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        highlight ? 'border-[#8FA83F]/40 bg-[#8FA83F]/10' : 'border-white/10 bg-[#0a0b08]'
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn('font-machina mt-0.5 text-2xl font-bold', highlight && 'text-primary')}>
        {value.toLocaleString('es')}
      </p>
    </div>
  )
}
