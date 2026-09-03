'use client'

import { useState } from 'react'
import { CalendarClock, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { NETWORKS, networkMeta } from '@/lib/cabal'
import { useCreateLaunch } from '@/lib/api-client'
import { useUI } from '@/lib/store'

const EMOJIS = ['🚀', '🐕', '🐸', '🐹', '🐈', '🦍', '💎', '🪙', '🌕', '🔥', '👽', '🤖', '🎩', '🦜', '🧟', '⚡']

export function PostLaunchDialog() {
  const { postLaunchOpen, setPostLaunchOpen } = useUI()
  const createLaunch = useCreateLaunch()
  const [form, setForm] = useState({
    name: '',
    ticker: '',
    emoji: '🚀',
    network: 'solana',
    launchAt: '',
    description: '',
    website: '',
    twitter: '',
    telegram: '',
  })
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    setError('')
    if (!form.name.trim() || !form.ticker.trim() || !form.launchAt) {
      setError('Nombre, ticker y fecha son obligatorios')
      return
    }
    createLaunch.mutate(form, {
      onSuccess: () => {
        setPostLaunchOpen(false)
        setForm({ name: '', ticker: '', emoji: '🚀', network: 'solana', launchAt: '', description: '', website: '', twitter: '', telegram: '' })
      },
      onError: (e: Error) => setError(e.message),
    })
  }

  return (
    <Dialog open={postLaunchOpen} onOpenChange={setPostLaunchOpen}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-[#00ff88]/20 bg-[#0b120d] p-0 sm:max-w-lg" aria-describedby={undefined}>
        <div className="border-b border-[#00ff88]/12 p-5">
          <DialogTitle className="font-display text-lg font-bold">
            Publicar lanzamiento <span className="text-primary">+40 ⚡</span>
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Avisa a la comunidad antes de que salga. Ganas puntos cuando la gente da hype a tu launch (+1 por hype).
          </DialogDescription>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pl-name" className="text-xs font-semibold">Nombre del token *</Label>
              <Input id="pl-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Smole Coin" className="h-10 border-[#00ff88]/15 bg-[#060a08]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-ticker" className="text-xs font-semibold">Ticker *</Label>
              <Input id="pl-ticker" value={form.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())} placeholder="SMOL" className="h-10 border-[#00ff88]/15 bg-[#060a08] font-mono" />
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
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                    form.network === key
                      ? 'border-[#00ff88]/50 bg-[#00ff88]/10 text-primary'
                      : 'border-[#00ff88]/12 text-muted-foreground hover:border-[#00ff88]/30'
                  )}
                  style={form.network === key ? { borderColor: `${meta.color}80`, color: meta.color, background: `${meta.color}12` } : undefined}
                >
                  {meta.emoji} {meta.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pl-when" className="text-xs font-semibold">Fecha y hora *</Label>
              <Input
                id="pl-when"
                type="datetime-local"
                value={form.launchAt}
                onChange={(e) => set('launchAt', e.target.value)}
                className="h-10 border-[#00ff88]/15 bg-[#060a08] [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Emoji / identidad</Label>
              <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-[#00ff88]/15 bg-[#060a08] p-1.5">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => set('emoji', e)}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg transition-all',
                      form.emoji === e ? 'bg-[#00ff88]/15 ring-1 ring-[#00ff88]/50' : 'hover:bg-[#00ff88]/8'
                    )}
                    aria-label={`Elegir ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pl-desc" className="text-xs font-semibold">¿Por qué va a ser grande? (tu pitch)</Label>
            <Textarea
              id="pl-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="LP quemada, mint revocado, comunidad lista, KOLs confirmados…"
              className="min-h-[72px] resize-none border-[#00ff88]/15 bg-[#060a08]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pl-web" className="text-xs font-semibold text-muted-foreground">Website</Label>
              <Input id="pl-web" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" className="h-9 border-[#00ff88]/15 bg-[#060a08] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-x" className="text-xs font-semibold text-muted-foreground">X / Twitter</Label>
              <Input id="pl-x" value={form.twitter} onChange={(e) => set('twitter', e.target.value)} placeholder="https://x.com/…" className="h-9 border-[#00ff88]/15 bg-[#060a08] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-tg" className="text-xs font-semibold text-muted-foreground">Telegram</Label>
              <Input id="pl-tg" value={form.telegram} onChange={(e) => set('telegram', e.target.value)} placeholder="https://t.me/…" className="h-9 border-[#00ff88]/15 bg-[#060a08] text-sm" />
            </div>
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-[#ff8080]">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <p className="flex flex-1 items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              El countdown empieza de inmediato. La comunidad verá tu launch primero en el Radar.
            </p>
            <Button
              onClick={submit}
              disabled={createLaunch.isPending}
              className="h-11 gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground neon-shadow hover:bg-[#00ff88]"
            >
              <Zap className="h-4 w-4" strokeWidth={2.5} />
              {createLaunch.isPending ? 'Publicando…' : 'Publicar +40 ⚡'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { networkMeta }
