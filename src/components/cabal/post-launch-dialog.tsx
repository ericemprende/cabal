'use client'

import { useRef, useState } from 'react'
import { CalendarClock, ImagePlus, Loader2, Trash2, Zap } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { NETWORKS } from '@/lib/cabal'
import { useCreateLaunch } from '@/lib/api-client'
import { useUI } from '@/lib/store'

const EMPTY_FORM = {
  name: '',
  ticker: '',
  network: 'solana',
  launchAt: '',
  description: '',
  website: '',
  twitter: '',
  telegram: '',
  image: '',
  banner: '',
}

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !body.url) throw new Error(body.error ?? 'No se pudo subir la imagen')
  return body.url
}

function ImageDrop({
  url,
  onSelect,
  onRemove,
  aspect,
  label,
  hint,
  disabled,
}: {
  url: string
  onSelect: (file: File) => void
  onRemove: () => void
  aspect: 'square' | 'video'
  label: string
  hint: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">
        {label} {aspect === 'video' && <span className="font-normal text-muted-foreground">· opcional</span>}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSelect(f)
          e.target.value = ''
        }}
        aria-label={label}
      />
      {url ? (
        <div
          className={cn(
            'group relative overflow-hidden rounded-xl border border-white/10 bg-[#0a0b08]',
            aspect === 'square' ? 'h-24 w-24' : 'h-28 w-full'
          )}
        >
          <Image src={url} alt={label} fill sizes="320px" className="object-cover" unoptimized />
          <button
            onClick={onRemove}
            disabled={disabled}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a0b08]/85 text-zinc-300 backdrop-blur transition-colors hover:text-[#ff8080]"
            aria-label={`Quitar ${label.toLowerCase()}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#0a0b08] text-xs font-medium text-muted-foreground transition-colors hover:border-[#8FA83F]/40 hover:text-foreground',
            aspect === 'square' ? 'h-24' : 'h-28'
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Subiendo…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" aria-hidden /> {hint}
            </>
          )}
        </button>
      )}
      {aspect === 'square' && <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP o GIF · máx 2.5 MB</p>}
    </div>
  )
}

export function PostLaunchDialog() {
  const { postLaunchOpen, setPostLaunchOpen } = useUI()
  const createLaunch = useCreateLaunch()
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSelect = (key: 'image' | 'banner') => async (file: File) => {
    setError('')
    setForm((f) => ({ ...f, [key]: 'uploading' }))
    try {
      const url = await uploadImage(file)
      setForm((f) => ({ ...f, [key]: url }))
    } catch (e) {
      setForm((f) => ({ ...f, [key]: '' }))
      toast.error((e as Error).message)
    }
  }

  const submit = () => {
    setError('')
    if (!form.name.trim() || !form.ticker.trim() || !form.launchAt) {
      setError('Nombre, ticker y fecha son obligatorios')
      return
    }
    createLaunch.mutate(
      {
        ...form,
        image: form.image === 'uploading' ? '' : form.image,
        banner: form.banner === 'uploading' ? '' : form.banner,
      },
      {
        onSuccess: () => {
          setPostLaunchOpen(false)
          setForm(EMPTY_FORM)
        },
        onError: (e: Error) => setError(e.message),
      }
    )
  }

  return (
    <Dialog open={postLaunchOpen} onOpenChange={setPostLaunchOpen}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-lg" aria-describedby={undefined}>
        <div className="border-b border-white/10 p-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold">
            Publicar lanzamiento
            <span className="inline-flex items-center gap-1 rounded-full border border-[#8FA83F]/25 bg-[#8FA83F]/8 px-2 py-0.5 text-xs font-semibold text-primary">
              <Zap className="h-3 w-3" aria-hidden /> +40
            </span>
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Avisa a la comunidad antes de que salga. Ganas puntos cuando la gente da hype a tu launch (+1 por hype).
          </DialogDescription>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pl-name" className="text-xs font-semibold">Nombre del token *</Label>
              <Input id="pl-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Smole Coin" className="h-10 bg-[#0a0b08]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-ticker" className="text-xs font-semibold">Ticker *</Label>
              <Input id="pl-ticker" value={form.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())} placeholder="SMOL" className="h-10 bg-[#0a0b08] font-mono" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Red *</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(NETWORKS).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => set('network', key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                    form.network === key
                      ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary'
                      : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} aria-hidden />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pl-when" className="text-xs font-semibold">Fecha y hora *</Label>
            <Input
              id="pl-when"
              type="datetime-local"
              value={form.launchAt}
              onChange={(e) => set('launchAt', e.target.value)}
              className="h-10 max-w-xs bg-[#0a0b08] [color-scheme:dark]"
            />
          </div>

          {/* Identidad visual: imagen del token + banner opcional */}
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <ImageDrop
              url={form.image}
              onSelect={handleSelect('image')}
              onRemove={() => set('image', '')}
              aspect="square"
              label="Imagen del token"
              hint="Subir imagen"
              disabled={createLaunch.isPending}
            />
            <ImageDrop
              url={form.banner}
              onSelect={handleSelect('banner')}
              onRemove={() => set('banner', '')}
              aspect="video"
              label="Banner"
              hint="Sube un banner (16:9)"
              disabled={createLaunch.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pl-desc" className="text-xs font-semibold">¿Por qué va a ser grande? (tu pitch)</Label>
            <Textarea
              id="pl-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="LP quemada, mint revocado, comunidad lista, KOLs confirmados…"
              className="min-h-[72px] resize-none bg-[#0a0b08]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pl-web" className="text-xs font-semibold text-muted-foreground">Website</Label>
              <Input id="pl-web" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" className="h-9 bg-[#0a0b08] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-x" className="text-xs font-semibold text-muted-foreground">X / Twitter</Label>
              <Input id="pl-x" value={form.twitter} onChange={(e) => set('twitter', e.target.value)} placeholder="https://x.com/…" className="h-9 bg-[#0a0b08] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-tg" className="text-xs font-semibold text-muted-foreground">Telegram</Label>
              <Input id="pl-tg" value={form.telegram} onChange={(e) => set('telegram', e.target.value)} placeholder="https://t.me/…" className="h-9 bg-[#0a0b08] text-sm" />
            </div>
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-[#ff8080]">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <p className="flex flex-1 items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
              El countdown empieza de inmediato. La comunidad verá tu launch primero en el Radar.
            </p>
            <Button
              onClick={submit}
              disabled={createLaunch.isPending}
              className="h-11 gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground neon-shadow hover:bg-[#8FA83F]"
            >
              <Zap className="h-4 w-4" strokeWidth={2.5} />
              {createLaunch.isPending ? 'Publicando…' : 'Publicar · +40 pts'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
