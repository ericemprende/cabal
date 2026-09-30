'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { jsonFetch } from '@/lib/api-client'

type Draft = { key: string; subject: string; body: string; ctaLabel: string; ctaUrl: string }
type Stats = { total: number; sent: number; pending: number; optedOut: number }
type BroadcastDTO = { draft: Draft; stats: Stats; provider: string | null; from: string | null }

const KEY = ['admin', 'email-broadcast'] as const

/**
 * Correos: estado del proveedor, prueba de envío y el anuncio masivo (el
 * lanzamiento oficial). El anuncio sale por tandas y recuerda a quién llegó ya.
 */
export function AdminEmail() {
  const qc = useQueryClient()
  const q = useQuery<BroadcastDTO>({ queryKey: KEY, queryFn: () => jsonFetch('/api/admin/email/broadcast') })
  const [edit, setEdit] = useState<Partial<Draft>>({})
  const [testTo, setTestTo] = useState('')
  const [limit, setLimit] = useState(90)

  const draft: Draft | null = q.data ? { ...q.data.draft, ...edit } : null
  const set = (k: keyof Draft) => (v: string) => setEdit((d) => ({ ...d, [k]: v }))

  const act = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      jsonFetch<{ ok: boolean; sent?: number; error?: string | null }>('/api/admin/email/broadcast', {
        method: 'POST',
        body: JSON.stringify({ ...draft, ...payload }),
      }),
    onSuccess: (res, payload) => {
      qc.invalidateQueries({ queryKey: KEY })
      if (payload.action === 'test') toast.success(`Prueba enviada a ${payload.to}`)
      else if (payload.action === 'send') {
        if (res.error) toast.warning(`Salieron ${res.sent}. Se paró: ${res.error}`)
        else toast.success(`Enviados ${res.sent} correos`)
      } else toast.success('Borrador guardado')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (q.isLoading || !draft || !q.data) {
    return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Cargando" />
  }
  const { stats, provider, from } = q.data
  const busy = act.isPending

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <Mail className="h-5 w-5 text-primary" aria-hidden /> Correos
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Los correos de seguridad (verificar correo, código de acceso, recuperar contraseña, aviso de cambio de
          contraseña y bienvenida) salen solos. Aquí se manda el anuncio a toda la comunidad.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4 text-xs">
        {provider ? (
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
            Enviando con <b className="capitalize">{provider}</b> desde <span className="font-mono">{from}</span>
          </p>
        ) : (
          <p className="flex items-start gap-2 text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Sin proveedor: añade RESEND_API_KEY y EMAIL_FROM (&quot;Cabal &lt;no-reply@cabal.army&gt;&quot;) en Dokploy y
            verifica el dominio en Resend.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Destinatarios', stats.total],
          ['Ya enviados', stats.sent],
          ['Pendientes', stats.pending],
          ['Dados de baja', stats.optedOut],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-[#0a0b08] p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-[#121410] p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Identificador del anuncio</Label>
            <Input value={draft.key} onChange={(e) => set('key')(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Asunto</Label>
            <Input value={draft.subject} onChange={(e) => set('subject')(e.target.value)} className="text-sm" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/70">
          Con el mismo identificador nadie lo recibe dos veces. Cámbialo solo para un anuncio nuevo.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mensaje (separa los párrafos con una línea en blanco)</Label>
          <Textarea value={draft.body} onChange={(e) => set('body')(e.target.value)} rows={8} className="text-sm" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Texto del botón</Label>
            <Input value={draft.ctaLabel} onChange={(e) => set('ctaLabel')(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Enlace del botón</Label>
            <Input value={draft.ctaUrl} onChange={(e) => set('ctaUrl')(e.target.value)} className="font-mono text-sm" />
          </div>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act.mutate({ action: 'save' })}>
          Guardar borrador
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-[#121410] p-4">
        <Label className="text-xs text-muted-foreground">1 · Mándate una prueba y revísala en el móvil</Label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            className="text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !testTo.trim()}
            onClick={() => act.mutate({ action: 'test', to: testTo.trim() })}
          >
            Probar
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-[#8FA83F]/30 bg-[#8FA83F]/5 p-4">
        <Label className="text-xs text-muted-foreground">2 · Envía a la comunidad por tandas</Label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          El plan gratis de Resend manda 100 al día: deja la tanda en 90 y vuelve a pulsar mañana para seguir. Con el
          plan de pago puedes subirla hasta 500.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-24 font-mono text-sm"
          />
          <Button
            size="sm"
            disabled={busy || stats.pending === 0 || !provider}
            onClick={() => {
              const n = Math.min(limit, stats.pending)
              if (confirm(`¿Enviar "${draft.subject}" a ${n} personas? No se puede deshacer.`)) {
                act.mutate({ action: 'send', limit })
              }
            }}
            className="gap-1.5"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
            Enviar tanda ({Math.min(limit, stats.pending)})
          </Button>
        </div>
      </div>
    </div>
  )
}
