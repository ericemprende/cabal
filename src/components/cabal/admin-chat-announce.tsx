'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HandHeart, Link2, Loader2, Megaphone, Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { jsonFetch } from '@/lib/api-client'
import { timeAgo } from '@/lib/cabal'
import { cn } from '@/lib/utils'
import type { AdminChatAnnounceDTO } from '@/lib/types'

const KEY = ['admin', 'chat-announce'] as const
const MAX_BODY = 500
/** Cada cuánto se repite. "Otro" deja escribir las horas a mano. */
const PRESETS = [6, 12, 24, 48] as const

/**
 * Panel admin → Chat en vivo: el mensaje automático que Cabal publica en el
 * chat cada X horas (por defecto, el recordatorio de donaciones).
 */
export function AdminChatAnnounce({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient()
  const q = useQuery<AdminChatAnnounceDTO>({
    queryKey: KEY,
    queryFn: () => jsonFetch('/api/admin/chat-announce'),
    enabled,
  })
  const [draft, setDraft] = useState<Partial<AdminChatAnnounceDTO>>({})

  const save = useMutation({
    mutationFn: (patch: Partial<AdminChatAnnounceDTO>) =>
      jsonFetch<AdminChatAnnounceDTO>('/api/admin/chat-announce', { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (cfg) => {
      qc.setQueryData(KEY, cfg)
      setDraft({})
      toast.success('Aviso guardado')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const sendNow = useMutation({
    mutationFn: () =>
      jsonFetch<{ config: AdminChatAnnounceDTO }>('/api/admin/chat-announce', {
        method: 'POST',
        body: JSON.stringify({ action: 'send' }),
      }),
    onSuccess: (r) => {
      qc.setQueryData(KEY, r.config)
      toast.success('Aviso publicado en el chat')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (!q.data) return <p className="text-sm text-muted-foreground">No se pudo cargar el aviso del chat.</p>

  const cfg = { ...q.data, ...draft }
  const set = <K extends keyof AdminChatAnnounceDTO>(key: K, value: AdminChatAnnounceDTO[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))
  const dirty = Object.keys(draft).length > 0
  const isDonate = cfg.linkUrl === 'donate'
  const customHours = !PRESETS.includes(cfg.hours as (typeof PRESETS)[number])

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Un mensaje del propio Cabal en el chat en vivo, cada cierto tiempo. Se publica firmado por la cuenta oficial y
        con un botón: en el chat los enlaces que escribe la gente no son pulsables (así los scams no tienen dónde
        agarrarse), pero el de este aviso sí, porque lo pones tú.
      </p>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] px-4 py-3">
        <Switch
          checked={cfg.enabled}
          onCheckedChange={(v) => save.mutate({ ...draft, enabled: v })}
          aria-label="Activar el aviso automático"
        />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">{cfg.enabled ? 'Aviso activo' : 'Aviso apagado'}</p>
          <p className="text-[11px] text-muted-foreground">
            {cfg.lastAt ? `Último: ${timeAgo(cfg.lastAt)}` : 'Todavía no se ha publicado ninguno'}
            {cfg.enabled && cfg.nextAt && ` · siguiente ${new Date(cfg.nextAt).toLocaleString('es-ES')}`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => sendNow.mutate()}
          disabled={sendNow.isPending || !cfg.body.trim()}
          className="ml-auto gap-1.5 border-white/10 text-xs"
        >
          {sendNow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Enviar ahora
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-[#0a0b08] p-4">
        <div>
          <p className="text-[13px] font-semibold">Cada cuánto se repite</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {PRESETS.map((h) => (
              <button
                key={h}
                onClick={() => set('hours', h)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                  cfg.hours === h
                    ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                    : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30'
                )}
              >
                {h} h
              </button>
            ))}
            <Input
              type="number"
              min={1}
              max={720}
              value={customHours ? cfg.hours : ''}
              placeholder="Otro"
              onChange={(e) => set('hours', Math.min(720, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              className="h-8 w-20 border-white/10 bg-[#121410] text-center font-mono text-xs"
              aria-label="Horas entre avisos"
            />
          </div>
        </div>

        <label className="block">
          <span className="text-[13px] font-semibold">Mensaje</span>
          <Textarea
            value={cfg.body}
            maxLength={MAX_BODY}
            onChange={(e) => set('body', e.target.value)}
            className="mt-1.5 min-h-[96px] resize-none border-white/10 bg-[#121410] text-[13px]"
          />
          <span className="mt-1 block text-right text-[11px] text-muted-foreground">
            {cfg.body.length}/{MAX_BODY}
          </span>
        </label>

        <div>
          <p className="text-[13px] font-semibold">Botón del aviso</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => set('linkUrl', 'donate')}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                isDonate
                  ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                  : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30'
              )}
            >
              <HandHeart className="h-3.5 w-3.5" aria-hidden /> Abrir donaciones
            </button>
            <button
              onClick={() => set('linkUrl', isDonate ? '' : cfg.linkUrl)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                !isDonate
                  ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                  : 'border-white/10 text-muted-foreground hover:border-[#8FA83F]/30'
              )}
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden /> Un enlace
            </button>
          </div>
          {isDonate ? (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              El botón abre el diálogo de donaciones dentro de la app, sin mandar a nadie fuera.
            </p>
          ) : (
            <Input
              value={cfg.linkUrl}
              onChange={(e) => set('linkUrl', e.target.value)}
              placeholder="https://… o una ruta de Cabal (/app)"
              className="mt-2 h-9 border-white/10 bg-[#121410] text-[13px]"
              aria-label="Enlace del botón"
            />
          )}
          <Input
            value={cfg.linkLabel}
            onChange={(e) => set('linkLabel', e.target.value)}
            maxLength={40}
            placeholder="Texto del botón"
            className="mt-2 h-9 border-white/10 bg-[#121410] text-[13px]"
            aria-label="Texto del botón"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">Deja el enlace vacío para publicar el aviso sin botón.</p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-white/8 px-3 py-2.5">
          <Switch
            checked={cfg.onlyIfActive}
            onCheckedChange={(v) => set('onlyIfActive', v)}
            aria-label="Solo si hay movimiento"
          />
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Solo si hay movimiento.</span> No repetirlo mientras nadie
            haya escrito en el chat desde el último aviso, para no dejar la pantalla llena de recordatorios apilados.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => save.mutate(draft)}
          disabled={!dirty || save.isPending}
          className="gap-1.5 text-xs font-bold"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar cambios
        </Button>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Así se verá en el chat</p>
        <div className="mt-2.5 rounded-xl border border-primary/25 bg-primary/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
            <Megaphone className="h-3.5 w-3.5" aria-hidden /> Cabal
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground/90">
            {cfg.body.trim() || 'Escribe el mensaje…'}
          </p>
          {cfg.linkUrl.trim() && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground">
              {isDonate && <HandHeart className="h-3.5 w-3.5" aria-hidden />}
              {cfg.linkLabel.trim() || 'Abrir'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
