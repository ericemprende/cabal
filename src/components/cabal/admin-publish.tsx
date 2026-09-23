'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Coins, Loader2, Rocket, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImageDrop } from '@/components/cabal/image-drop'
import { NetworkIcon, TimezoneHint } from '@/components/cabal/shared'
import { LAUNCHPADS, NETWORKS, type NetworkKey } from '@/lib/cabal'
import { jsonFetch, uploadImage, useAdminCreateLaunch } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type Mode = 'launched' | 'upcoming'

type TokenMeta = {
  found: boolean
  network: string
  name: string
  symbol: string
  image: string
  banner: string
  description: string
  website: string
  twitter: string
  telegram: string
}

const EMPTY = {
  name: '',
  ticker: '',
  isPrivate: false,
  network: 'solana' as string,
  launchAt: '',
  dateConfirmed: true,
  description: '',
  image: '',
  banner: '',
  website: '',
  twitter: '',
  telegram: '',
  contract: '',
  launchpad: '',
  lpLocked: false,
  mintRevoked: false,
}

/**
 * Publicar como Cabal: el admin sube un token ya lanzado o un launch próximo,
 * firmado por la cuenta oficial de Cabal y marcado como verificado.
 */
export function AdminPublish() {
  const create = useAdminCreateLaunch()
  const [mode, setMode] = useState<Mode>('launched')
  const [form, setForm] = useState(EMPTY)
  const [looking, setLooking] = useState(false)
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const pick = (key: 'image' | 'banner') => async (file: File) => {
    try {
      set(key, await uploadImage(file))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Rellena lo que falte con la ficha pública del token (DexScreener / pump.fun)
  const lookup = async () => {
    const ca = form.contract.trim()
    if (!ca) return toast.error('Pega primero el contrato (CA)')
    setLooking(true)
    try {
      const m = await jsonFetch<TokenMeta>(`/api/tokens/lookup?ca=${encodeURIComponent(ca)}`)
      if (!m.found) {
        toast.warning('No se encontró la ficha de ese token: completa los datos a mano')
        return
      }
      setForm((f) => ({
        ...f,
        name: f.name || m.name,
        ticker: f.ticker || m.symbol.toUpperCase(),
        network: m.network && m.network in NETWORKS ? m.network : f.network,
        image: f.image || m.image,
        banner: f.banner || m.banner,
        description: f.description || m.description,
        website: f.website || m.website,
        twitter: f.twitter || m.twitter,
        telegram: f.telegram || m.telegram,
      }))
      toast.success('Datos completados desde la ficha del token')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLooking(false)
    }
  }

  const submit = () => {
    if (!form.name.trim()) return toast.error('Falta el nombre')
    if (mode === 'launched' && !form.contract.trim()) return toast.error('Falta el contrato (CA)')
    if (mode === 'upcoming' && !form.launchAt) return toast.error('Falta la fecha del launch')
    create.mutate(
      {
        mode,
        ...form,
        ticker: form.ticker.trim(),
        contract: form.contract.trim(),
        launchpad: form.launchpad.trim(),
        website: form.website.trim(),
        twitter: form.twitter.trim(),
        telegram: form.telegram.trim(),
        isPrivate: mode === 'upcoming' && form.isPrivate,
        launchAt: form.launchAt ? new Date(form.launchAt).toISOString() : '',
      },
      { onSuccess: () => setForm(EMPTY) }
    )
  }

  const field = 'h-8 bg-[#0a0b08] text-[13px]'
  const label = 'text-[10px] uppercase tracking-wide text-muted-foreground'

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Publica un proyecto con la cuenta oficial de Cabal. Sale ya verificado, con el sello de proyecto
        oficial, y no suma puntos a nadie. Cabal lo avala pero no figura como su dev.
      </p>

      <OfficialAccountCard />

      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            { key: 'launched', icon: Coins, title: 'Token ya lanzado', hint: 'Entra directo en la pestaña Tokens con su precio' },
            { key: 'upcoming', icon: Rocket, title: 'Launch próximo', hint: 'Entra en el Radar con cuenta atrás y avisos' },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
              mode === m.key ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10' : 'border-white/10 hover:border-[#8FA83F]/30'
            )}
          >
            <m.icon className={cn('mt-0.5 h-4 w-4 shrink-0', mode === m.key ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
            <span>
              <span className="block text-sm font-bold">{m.title}</span>
              <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
        <div className="space-y-1">
          <Label className={label}>Contrato (CA){mode === 'upcoming' && ' — opcional'}</Label>
          <div className="flex gap-2">
            <Input
              value={form.contract}
              onChange={(e) => set('contract', e.target.value)}
              placeholder="0x… / dirección del contrato"
              spellCheck={false}
              autoComplete="off"
              className={cn(field, 'font-mono')}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={lookup}
              disabled={looking || !form.contract.trim()}
              className="shrink-0 gap-1.5 text-xs"
            >
              {looking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Autocompletar
            </Button>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className={label}>Nombre</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} className={field} />
          </div>
          <div className="space-y-1">
            <Label className={label}>Ticker{mode === 'upcoming' && form.isPrivate && ' (oculto)'}</Label>
            <Input
              value={form.ticker}
              onChange={(e) => set('ticker', e.target.value.toUpperCase())}
              className={cn(field, 'font-mono')}
            />
          </div>
          <div className="space-y-1">
            <Label className={label}>{mode === 'launched' ? 'Fecha de lanzamiento (opcional, por defecto ahora)' : 'Fecha y hora'}</Label>
            <Input
              type="datetime-local"
              value={form.launchAt}
              onChange={(e) => set('launchAt', e.target.value)}
              className={cn(field, '[color-scheme:dark]')}
            />
            {form.launchAt && <TimezoneHint value={form.launchAt} compact />}
            {mode === 'upcoming' && (
              <label className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!form.dateConfirmed}
                  onChange={(e) => set('dateConfirmed', !e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-300"
                />
                Fecha estimada, aún no confirmada
              </label>
            )}
          </div>
          <div className="space-y-1">
            <Label className={label}>Red</Label>
            <div className="flex flex-wrap gap-1">
              {Object.entries(NETWORKS).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set('network', key)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold',
                    form.network === key ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground'
                  )}
                >
                  <NetworkIcon network={key} className="h-3 w-3" />
                  {meta.short}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className={label}>Launchpad (opcional)</Label>
            <Input
              value={form.launchpad}
              onChange={(e) => set('launchpad', e.target.value)}
              list="admin-publish-launchpads"
              className={field}
            />
            <datalist id="admin-publish-launchpads">
              {(LAUNCHPADS[form.network as NetworkKey] ?? []).map((lp) => (
                <option key={lp} value={lp} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label className={label}>Website</Label>
            <Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" className={field} />
          </div>
          <div className="space-y-1">
            <Label className={label}>Twitter / X</Label>
            <Input value={form.twitter} onChange={(e) => set('twitter', e.target.value)} placeholder="https://x.com/…" className={field} />
          </div>
          <div className="space-y-1">
            <Label className={label}>Telegram</Label>
            <Input value={form.telegram} onChange={(e) => set('telegram', e.target.value)} placeholder="https://t.me/…" className={field} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <ImageDrop
            url={form.image}
            onSelect={pick('image')}
            onPickUrl={(u) => set('image', u)}
            onRemove={() => set('image', '')}
            aspect="square"
            label="Logo / imagen"
            hint="Subir logo"
          />
          <ImageDrop
            url={form.banner}
            onSelect={pick('banner')}
            onPickUrl={(u) => set('banner', u)}
            onRemove={() => set('banner', '')}
            aspect="video"
            label="Banner"
            hint="Sube un banner (16:9)"
          />
        </div>

        <div className="space-y-1">
          <Label className={label}>Descripción</Label>
          <Textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={800}
            className="min-h-[72px] resize-none bg-[#0a0b08] text-[13px]"
          />
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] font-medium text-muted-foreground">
          {mode === 'upcoming' && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={form.isPrivate} onChange={(e) => set('isPrivate', e.target.checked)} className="h-3.5 w-3.5 accent-[#8FA83F]" />
              Ticker privado
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={form.lpLocked} onChange={(e) => set('lpLocked', e.target.checked)} className="h-3.5 w-3.5 accent-[#8FA83F]" />
            LP bloqueada
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={form.mintRevoked} onChange={(e) => set('mintRevoked', e.target.checked)} className="h-3.5 w-3.5 accent-[#8FA83F]" />
            Mint revocado
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-3">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Se publica como <b className="text-foreground">Cabal</b>, verificado
          </p>
          <Button size="sm" onClick={submit} disabled={create.isPending} className="gap-1.5 px-4 text-xs font-bold">
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
            {mode === 'launched' ? 'Publicar token' : 'Publicar launch'}
          </Button>
        </div>
      </div>
    </div>
  )
}

type OfficialAccountDTO = { user: { id: string; handle: string; name: string; avatar: string } | null }

/** Qué cuenta firma como Cabal, y cambiarla por una con la que se pueda entrar. */
function OfficialAccountCard() {
  const qc = useQueryClient()
  const [handle, setHandle] = useState('')
  const q = useQuery<OfficialAccountDTO>({
    queryKey: ['admin', 'official-account'],
    queryFn: () => jsonFetch('/api/admin/official-account'),
  })
  const save = useMutation({
    mutationFn: (h: string) =>
      jsonFetch<OfficialAccountDTO & { merged: string | null }>('/api/admin/official-account', {
        method: 'POST',
        body: JSON.stringify({ handle: h }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries()
      setHandle('')
      toast.success(
        res.merged
          ? `@${res.user?.handle} es la cuenta oficial. Todo lo de @${res.merged} pasó a ella y @${res.merged} se borró.`
          : `@${res.user?.handle} es la cuenta oficial de Cabal`
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const current = q.data?.user
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
      <p className="min-w-0 flex-1 text-[12px] text-muted-foreground">
        Cuenta oficial:{' '}
        {q.isLoading ? (
          '…'
        ) : current ? (
          <b className="text-foreground">
            {current.name} @{current.handle}
          </b>
        ) : (
          'se creará sola al publicar'
        )}
      </p>
      <Input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="@usuario"
        autoComplete="off"
        spellCheck={false}
        className="h-8 w-40 bg-[#121410] text-[13px]"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={save.isPending || !handle.trim()}
        onClick={() => {
          const h = handle.trim().replace(/^@/, '')
          if (confirm(`@${h} pasará a ser la cuenta oficial de Cabal. Si la actual se creó sola, todo lo suyo pasa a @${h} y se borra. ¿Seguir?`)) {
            save.mutate(h)
          }
        }}
        className="gap-1.5 text-xs"
      >
        {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Usar esta cuenta
      </Button>
    </div>
  )
}
