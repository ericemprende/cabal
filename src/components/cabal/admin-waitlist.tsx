'use client'

import { useState } from 'react'
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  Mail,
  Search,
  Send,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminDeleteWaitlist, useAdminUpdateWaitlist, useAdminWaitlist } from '@/lib/api-client'
import { timeAgo } from '@/lib/cabal'
import { cn } from '@/lib/utils'
import type { WaitlistEntryDTO } from '@/lib/types'

/**
 * Pestaña "Lista de espera" del panel admin: quién se registró con su cuenta de
 * X, los datos que dejó en el formulario y el botón para habilitar el acceso a
 * mano, uno a uno o en bloque.
 */

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'EN REVISIÓN', cls: 'border-[#ffb020]/40 bg-[#ffb020]/10 text-[#ffb020]' },
  approved: { label: 'HABILITADO', cls: 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' },
  rejected: { label: 'RECHAZADO', cls: 'border-[#ff4d5e]/40 bg-[#ff4d5e]/10 text-[#ff8080]' },
}

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'En revisión' },
  { key: 'approved', label: 'Habilitados' },
  { key: 'rejected', label: 'Rechazados' },
]

export function AdminWaitlist({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [showIncomplete, setShowIncomplete] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const list = useAdminWaitlist(enabled, { status, q, all: showIncomplete })
  const update = useAdminUpdateWaitlist()
  const remove = useAdminDeleteWaitlist()

  const entries = list.data?.entries ?? []
  const stats = list.data?.stats

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const bulk = (newStatus: string) => {
    update.mutate({ ids: [...selected], status: newStatus }, { onSuccess: () => setSelected(new Set()) })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Registros de la lista de espera de cabal.army. Cada persona se autenticó con su cuenta real de X;
        habilita el acceso manualmente a quien quieras dejar entrar en la próxima tanda.
      </p>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Stat label="Registrados" value={stats?.total ?? 0} icon={<Users className="h-4 w-4" />} highlight />
        <Stat label="En revisión" value={stats?.pending ?? 0} />
        <Stat label="Habilitados" value={stats?.approved ?? 0} />
        <Stat label="Compartieron" value={stats?.shared ?? 0} icon={<Send className="h-4 w-4" />} />
        <Stat label="Sin terminar" value={stats?.incomplete ?? 0} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all',
                status === f.key
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
            placeholder="Buscar por @handle, nombre o email…"
            className="h-9 border-white/10 bg-[#0a0b08] pl-8 text-xs"
            aria-label="Buscar en la lista de espera"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={showIncomplete}
            onChange={(e) => setShowIncomplete(e.target.checked)}
            className="accent-[#8FA83F]"
          />
          Incluir registros sin terminar
        </label>

        <Button
          asChild
          size="sm"
          variant="ghost"
          className="h-9 gap-1.5 rounded-lg border border-white/10 px-3 text-[11px] font-bold"
        >
          <a href={`/api/admin/waitlist/export${showIncomplete ? '?all=1' : ''}`} download>
            <Download className="h-3.5 w-3.5" aria-hidden /> CSV
          </a>
        </Button>
      </div>

      {/* Acciones en bloque */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#8FA83F]/30 bg-[#8FA83F]/10 px-3.5 py-2.5">
          <span className="text-[12px] font-bold text-primary">{selected.size} seleccionados</span>
          <Button
            size="sm"
            onClick={() => bulk('approved')}
            disabled={update.isPending}
            className="ml-auto h-8 gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground hover:bg-[#8FA83F]"
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Habilitar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => bulk('rejected')}
            disabled={update.isPending}
            className="h-8 gap-1 rounded-lg border border-[#ff8080]/30 px-2.5 text-[11px] font-bold text-[#ff8080] hover:bg-[#ff8080]/10"
          >
            <XCircle className="h-3 w-3" aria-hidden /> Rechazar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            className="h-8 rounded-lg px-2.5 text-[11px] font-bold text-muted-foreground"
          >
            Limpiar
          </Button>
        </div>
      )}

      {list.isLoading && [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}

      {!list.isLoading && entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay nadie en la lista de espera
        </p>
      )}

      {entries.map((e) => (
        <WaitlistRow
          key={e.id}
          entry={e}
          checked={selected.has(e.id)}
          onToggle={() => toggle(e.id)}
          onStatus={(s) => update.mutate({ id: e.id, status: s })}
          onNote={(note) => update.mutate({ id: e.id, note })}
          onDelete={() => remove.mutate(e.id)}
          busy={update.isPending || remove.isPending}
        />
      ))}
    </div>
  )
}

function WaitlistRow({
  entry: e,
  checked,
  onToggle,
  onStatus,
  onNote,
  onDelete,
  busy,
}: {
  entry: WaitlistEntryDTO
  checked: boolean
  onToggle: () => void
  onStatus: (status: string) => void
  onNote: (note: string) => void
  onDelete: () => void
  busy: boolean
}) {
  const [note, setNote] = useState(e.note)
  const meta = STATUS_META[e.status] ?? STATUS_META.pending
  // Antigüedad de la cuenta de X: una cuenta de hace días es señal de bot
  const ageDays = e.xCreatedAt
    ? Math.floor((Date.now() - new Date(e.xCreatedAt).getTime()) / 86_400_000)
    : null

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <div className="flex flex-wrap items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 accent-[#8FA83F]"
          aria-label={`Seleccionar @${e.xHandle}`}
        />

        <span className="mt-0.5 font-mono text-[11px] font-bold text-muted-foreground">#{e.position}</span>

        {e.xAvatar ? (
          <img src={e.xAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#121410] text-sm">🐺</div>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
            <a
              href={`https://x.com/${e.xHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-primary"
            >
              @{e.xHandle}
            </a>
            {e.xVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#1d9bf0]" aria-label="Verificado en X" />}
            <span className="truncate text-[11px] font-normal text-muted-foreground">{e.xName}</span>
            {!e.completed && (
              <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                SIN TERMINAR
              </span>
            )}
          </p>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
            {e.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" aria-hidden /> {e.email}
              </span>
            )}
            <span>{e.xFollowers.toLocaleString('es')} seguidores</span>
            {ageDays !== null && (
              <span className={cn(ageDays < 30 && 'text-[#ffb020]')}>Cuenta de {ageDays} días</span>
            )}
            <span>{timeAgo(e.createdAt)}</span>
          </p>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground/80">
            {e.telegram && <span>TG: @{e.telegram}</span>}
            {e.country && <span>{e.country}</span>}
            {e.wallet && <span className="truncate font-mono">Wallet: {e.wallet}</span>}
            {e.referredBy && <span>Invitado por @{e.referredBy}</span>}
            {e.shared && (
              <span className="flex items-center gap-1 text-primary">
                <Send className="h-3 w-3" aria-hidden /> Compartió el post
              </span>
            )}
          </p>

          {e.reason && (
            <p className="mt-1 rounded-lg bg-[#121410] px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {e.reason}
            </p>
          )}

          <div className="mt-2 flex items-center gap-1.5">
            <Input
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              onBlur={() => note !== e.note && onNote(note)}
              placeholder="Nota interna…"
              maxLength={300}
              className="h-8 border-white/10 bg-[#121410] text-[11px]"
              aria-label={`Nota sobre @${e.xHandle}`}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider', meta.cls)}>
            {meta.label}
          </span>
          <div className="flex items-center gap-1.5">
            {e.status !== 'approved' && (
              <Button
                size="sm"
                onClick={() => onStatus('approved')}
                disabled={busy}
                className="h-8 gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground hover:bg-[#8FA83F]"
              >
                <CheckCircle2 className="h-3 w-3" aria-hidden /> Habilitar
              </Button>
            )}
            {e.status !== 'rejected' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStatus('rejected')}
                disabled={busy}
                className="h-8 gap-1 rounded-lg border border-[#ff8080]/30 px-2.5 text-[11px] font-bold text-[#ff8080] hover:bg-[#ff8080]/10"
              >
                <XCircle className="h-3 w-3" aria-hidden /> Rechazar
              </Button>
            )}
            {e.status === 'rejected' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                disabled={busy}
                className="h-8 w-8 rounded-lg border border-white/10 p-0 text-muted-foreground hover:text-[#ff8080]"
                aria-label={`Eliminar a @${e.xHandle}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
  highlight,
}: {
  label: string
  value: number
  icon?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        highlight ? 'border-[#8FA83F]/40 bg-[#8FA83F]/10' : 'border-white/10 bg-[#0a0b08]'
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn('font-machina mt-0.5 text-2xl font-bold', highlight && 'text-primary')}>
        {value.toLocaleString('es')}
      </p>
    </div>
  )
}
