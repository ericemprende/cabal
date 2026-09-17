'use client'

import { useMemo, useState } from 'react'
import { Check, Code2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useTokens } from '@/lib/api-client'
import { fmtMc, fmtPct, networkMeta } from '@/lib/cabal'
import { cn } from '@/lib/utils'
import { TokenGlyph } from '@/components/cabal/shared'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TokenDTO } from '@/lib/types'

export type TickerSpeed = 'slow' | 'normal' | 'fast'

/** Segundos que tarda cada token en cruzar: así la velocidad no cambia con cuántos haya. */
const SECONDS_PER_ITEM: Record<TickerSpeed, number> = { slow: 9, normal: 6, fast: 3.5 }

/**
 * La franja que se desplaza. La usan la barra de la app y la página de
 * incrustación para OBS (/embed/ticker).
 */
export function TickerStrip({
  tokens,
  speed = 'normal',
  large,
}: {
  tokens: TokenDTO[]
  speed?: TickerSpeed
  large?: boolean
}) {
  const doubled = [...tokens, ...tokens]
  return (
    <div
      className={cn('animate-ticker flex w-max items-center px-4', large ? 'gap-10' : 'gap-8')}
      style={{ animationDuration: `${Math.max(tokens.length, 4) * SECONDS_PER_ITEM[speed]}s` }}
      aria-hidden
    >
      {doubled.map((t, i) => (
        <span
          key={`${t.id}-${i}`}
          className={cn('flex items-center whitespace-nowrap font-medium', large ? 'gap-2 text-base' : 'gap-1.5 text-[11px]')}
        >
          <TokenGlyph
            src={t.image}
            ticker={t.ticker}
            size="xs"
            className={cn('rounded-full', large ? 'h-7 w-7 text-[11px]' : 'h-5 w-5 text-[8px]')}
          />
          <span className="font-semibold text-foreground/90">{t.ticker}</span>
          <span className="text-muted-foreground">{networkMeta(t.network).short}</span>
          <span className="text-foreground/80">{fmtMc(t.mc)}</span>
          <span className={cn(t.change24h >= 0 ? 'text-primary' : 'text-[#ff8080]')}>{fmtPct(t.change24h)}</span>
        </span>
      ))}
    </div>
  )
}

export type TickerLogo = 'full' | 'icon' | 'text' | 'badge'

const LOGO_OPTIONS: { value: TickerLogo; label: string }[] = [
  { value: 'full', label: 'Logo + nombre' },
  { value: 'badge', label: 'Con web' },
  { value: 'icon', label: 'Solo logo' },
  { value: 'text', label: 'Solo nombre' },
]

/** Marca fija al inicio de la barra incrustada: promociona Cabal en los streams. */
export function TickerBrand({ variant }: { variant: TickerLogo }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-r border-white/15 pl-4 pr-4">
      {variant !== 'text' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/cabal-logo.png" alt="Cabal" className="h-7 w-7 object-contain" />
      )}
      {variant !== 'icon' && (
        <span className="flex flex-col leading-none">
          <span className="font-machina text-base font-bold uppercase tracking-[0.2em] text-primary">Cabal</span>
          {variant === 'badge' && (
            <span className="mt-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">cabal.army</span>
          )}
        </span>
      )}
    </div>
  )
}

/** Barra completa de la incrustación: marca fija + tokens desplazándose. */
export function EmbedBar({ tokens, speed, logo }: { tokens: TokenDTO[]; speed: TickerSpeed; logo: TickerLogo }) {
  return (
    <div className="flex h-full w-full items-center overflow-hidden">
      <TickerBrand variant={logo} />
      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        {tokens.length > 0 && <TickerStrip tokens={tokens} speed={speed} large />}
      </div>
    </div>
  )
}

export function Ticker() {
  const { data: tokens } = useTokens('trending', 'all')
  const [embedOpen, setEmbedOpen] = useState(false)
  const items = (tokens ?? []).slice(0, 10)
  if (items.length === 0) return null
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 hidden h-8 items-center overflow-hidden border-t border-white/10 bg-[#0d0e0a]/95 backdrop-blur-md md:flex">
        <TickerStrip tokens={items} />
        <button
          onClick={() => setEmbedOpen(true)}
          className="absolute inset-y-0 right-0 flex items-center gap-1 border-l border-white/10 bg-[#0d0e0a] px-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
          title="Incrustar en OBS o en tu web"
        >
          <Code2 className="h-3.5 w-3.5" aria-hidden /> Embed
        </button>
      </div>
      <TickerEmbedDialog open={embedOpen} onOpenChange={setEmbedOpen} tokens={tokens ?? []} />
    </>
  )
}

function TickerEmbedDialog({
  open,
  onOpenChange,
  tokens,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  tokens: TokenDTO[]
}) {
  // Vacío = todos los tokens (y los que se añadan después también salen).
  const [selected, setSelected] = useState<string[]>([])
  const [speed, setSpeed] = useState<TickerSpeed>('normal')
  const [transparent, setTransparent] = useState(true)
  const [logo, setLogo] = useState<TickerLogo>('full')
  const [copied, setCopied] = useState<'url' | 'iframe' | null>(null)

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const url = useMemo(() => {
    const origin = typeof window === 'undefined' ? '' : window.location.origin
    const params = new URLSearchParams()
    if (selected.length) params.set('ids', selected.join(','))
    if (speed !== 'normal') params.set('speed', speed)
    if (!transparent) params.set('bg', 'solid')
    if (logo !== 'full') params.set('logo', logo)
    const qs = params.toString()
    return `${origin}/embed/ticker${qs ? `?${qs}` : ''}`
  }, [selected, speed, transparent, logo])

  const iframe = `<iframe src="${url}" width="100%" height="48" style="border:0;overflow:hidden" scrolling="no" allowtransparency="true"></iframe>`

  const copy = async (text: string, which: 'url' | 'iframe') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      toast.success('Copiado al portapapeles')
      setTimeout(() => setCopied(null), 1800)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const preview = selected.length ? tokens.filter((t) => selected.includes(t.id)) : tokens

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-[#0d0e0a] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" /> Incrustar la barra de tokens
          </DialogTitle>
          <DialogDescription>
            Elige qué tokens mostrar y copia el enlace para OBS o el código para tu web. Los precios se actualizan solos.
          </DialogDescription>
        </DialogHeader>

        {/* Selección de tokens */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Tokens · {selected.length ? `${selected.length} elegidos` : `todos (${tokens.length})`}
            </p>
            <div className="flex gap-1.5 text-[11px] font-semibold">
              <button onClick={() => setSelected([])} className="rounded-md px-2 py-0.5 text-primary hover:bg-white/5">
                Todos
              </button>
              <button
                onClick={() => setSelected(tokens.map((t) => t.id))}
                className="rounded-md px-2 py-0.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                Elegir uno a uno
              </button>
            </div>
          </div>
          <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
            {tokens.map((t) => {
              const on = selected.length === 0 || selected.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  aria-pressed={selected.includes(t.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
                    selected.includes(t.id)
                      ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10'
                      : 'border-white/10 hover:border-white/20',
                    !on && 'opacity-50'
                  )}
                >
                  <TokenGlyph src={t.image} ticker={t.ticker} size="xs" className="rounded-full" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.ticker}</span>
                  {selected.includes(t.id) && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sin ninguno elegido se muestran todos, incluidos los que se añadan más adelante.
          </p>
        </div>

        {/* Opciones */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">Logo</span>
            {LOGO_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setLogo(o.value)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 font-semibold',
                  logo === o.value ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Velocidad</span>
            {(['slow', 'normal', 'fast'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 font-semibold',
                  speed === s ? 'border-[#8FA83F]/50 bg-[#8FA83F]/10 text-primary' : 'border-white/10 text-muted-foreground'
                )}
              >
                {s === 'slow' ? 'Lenta' : s === 'normal' ? 'Normal' : 'Rápida'}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} className="accent-[#8FA83F]" />
            Fondo transparente
          </label>
        </div>

        {/* Vista previa */}
        <div className={cn('flex h-12 items-center overflow-hidden rounded-lg border border-white/10', transparent ? 'bg-[repeating-conic-gradient(#1a1c16_0%_25%,#121410_0%_50%)] bg-[length:16px_16px]' : 'bg-[#0d0e0a]')}>
          <EmbedBar tokens={preview} speed={speed} logo={logo} />
        </div>

        {/* Códigos */}
        <div className="space-y-3">
          <CodeRow
            label="Enlace para OBS (Fuente → Navegador, ancho 1920, alto 48)"
            value={url}
            copied={copied === 'url'}
            onCopy={() => copy(url, 'url')}
          />
          <CodeRow
            label="Código para incrustar en una web"
            value={iframe}
            copied={copied === 'iframe'}
            onCopy={() => copy(iframe, 'iframe')}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CodeRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 font-mono text-[11px] text-zinc-300">
          {value}
        </code>
        <button
          onClick={onCopy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar
        </button>
      </div>
    </div>
  )
}
