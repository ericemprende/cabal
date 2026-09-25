'use client'

import { Fragment, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { jsonFetch } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { cn } from '@/lib/utils'
import { fmtPct, fmtPrice } from '@/lib/cabal'
import type { CashtagDTO } from '@/app/api/tokens/cashtags/route'

/**
 * Texto de la gente (chat, tesis, descripciones) con los "$TICKER" convertidos
 * en un chip con el precio de ahora, como hace X con sus cashtags.
 *
 * Solo se convierten los tickers que existen como token en Cabal: fuera de
 * aquí el mismo símbolo lo usan veinte monedas distintas y enseñaríamos el
 * precio de otra. Lo que no casa se queda como texto, sin tocar.
 */

/** $ + 2 a 12 letras/números, empezando por letra, sin pegarse a otra palabra. */
const CASHTAG = /(^|[^\w$])\$([A-Za-z][A-Za-z0-9]{1,11})\b/g

export function useCashtags() {
  return useQuery<Record<string, CashtagDTO>>({
    queryKey: ['tokens', 'cashtags'],
    queryFn: () => jsonFetch('/api/tokens/cashtags'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

/** Chip de una moneda: ticker + precio + variación de 24h. Abre su ficha. */
export function Cashtag({ token, className }: { token: CashtagDTO; className?: string }) {
  const { openToken, openLaunch } = useUI()
  if (token.kind === 'launch') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openLaunch(token.id)
        }}
        title={`${token.name} · Radar`}
        className={cn(
          'mx-px inline-flex max-w-full items-baseline gap-1 rounded-md border border-[#8FA83F]/25 bg-[#8FA83F]/10 px-1.5 py-px align-baseline font-semibold text-primary transition-colors hover:border-[#8FA83F]/50 hover:bg-[#8FA83F]/20',
          className
        )}
      >
        <span>${token.ticker}</span>
        <span className="text-[0.8em]" aria-hidden>🚀</span>
      </button>
    )
  }
  const up = token.change24h >= 0
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openToken(token.id)
      }}
      title={`${token.name} · ${fmtPrice(token.price)} · ${fmtPct(token.change24h)} en 24h`}
      className={cn(
        'mx-px inline-flex max-w-full items-baseline gap-1 rounded-md border border-[#8FA83F]/25 bg-[#8FA83F]/10 px-1.5 py-px align-baseline font-semibold text-primary transition-colors hover:border-[#8FA83F]/50 hover:bg-[#8FA83F]/20',
        className
      )}
    >
      <span>${token.ticker}</span>
      <span className="font-mono text-[0.85em] font-normal tabular-nums text-foreground/70">{fmtPrice(token.price)}</span>
      <span className={cn('font-mono text-[0.8em] tabular-nums', up ? 'text-primary' : 'text-[#ff6b7a]')}>
        {fmtPct(token.change24h)}
      </span>
    </button>
  )
}

/** Enlaces http(s) y "dominio.tld/…" con www. */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi

type Part = string | CashtagDTO | { href: string; label: string }

/** Parte un trozo de texto en texto y enlaces (sin la puntuación final pegada). */
function splitLinks(text: string): Part[] {
  const out: Part[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0]
    const trail = raw.match(/[.,;:!?)\]]+$/)
    if (trail) raw = raw.slice(0, -trail[0].length)
    out.push(text.slice(last, m.index))
    out.push({ href: raw.startsWith('www.') ? `https://${raw}` : raw, label: raw })
    last = m.index + raw.length
  }
  out.push(text.slice(last))
  return out
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const { data: tokens } = useCashtags()

  const parts = useMemo(() => {
    const out: Part[] = []
    for (const chunk of splitLinks(text)) {
      if (typeof chunk !== 'string' || !tokens) {
        out.push(chunk)
        continue
      }
      let last = 0
      for (const m of chunk.matchAll(CASHTAG)) {
        const token = tokens[m[2].toUpperCase()]
        if (!token) continue
        const start = m.index + m[1].length
        out.push(chunk.slice(last, start), token)
        last = start + m[2].length + 1
      }
      out.push(chunk.slice(last))
    }
    return out
  }, [text, tokens])

  return (
    <span className={className}>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : 'href' in p ? (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            onClick={(e) => e.stopPropagation()}
            className="break-all text-primary underline-offset-2 hover:underline"
          >
            {p.label}
          </a>
        ) : (
          <Cashtag key={i} token={p} />
        )
      )}
    </span>
  )
}
