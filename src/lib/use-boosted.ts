'use client'

import { useMemo } from 'react'
import { useLaunches, useTokens } from '@/lib/api-client'
import type { BoostScoreDTO, LaunchDTO, TokenDTO } from '@/lib/types'

/**
 * Los proyectos con munición viva, mezclando el Radar y los tokens ya
 * lanzados, de más balas a menos.
 *
 * Mezclarlos importa: el banner es de quien más munición tenga, y si solo
 * mirase los launches, el dev que paga por su token ya lanzado no llegaría
 * nunca al sitio por el que pagó.
 *
 * Las dos consultas ya están en memoria (las usan el Radar y la barra de
 * precios), así que esto no pide nada nuevo al servidor.
 */
export type BoostedItem = {
  key: string
  kind: 'launch' | 'token'
  id: string
  /** Lo que se enseña como nombre corto: el ticker si lo hay. */
  label: string
  name: string
  image?: string | null
  network: string
  contract: string | null
  boost: BoostScoreDTO
  launch?: LaunchDTO
  token?: TokenDTO
}

export function useBoostedItems(): BoostedItem[] {
  const { data: launches } = useLaunches()
  const { data: tokens } = useTokens('trending', 'all')

  return useMemo(() => {
    const items: BoostedItem[] = []
    for (const l of launches ?? []) {
      if (!l.boost || l.boost.bullets <= 0) continue
      items.push({
        key: `launch:${l.id}`,
        kind: 'launch',
        id: l.id,
        label: l.ticker ? `$${l.ticker}` : l.name,
        name: l.name,
        image: l.image,
        network: l.network,
        contract: l.contract ?? null,
        boost: l.boost,
        launch: l,
      })
    }
    for (const t of tokens ?? []) {
      if (!t.boost || t.boost.bullets <= 0) continue
      items.push({
        key: `token:${t.id}`,
        kind: 'token',
        id: t.id,
        label: `$${t.ticker}`,
        name: t.name,
        image: t.image,
        network: t.network,
        contract: t.contract || null,
        boost: t.boost,
        token: t,
      })
    }
    // Empate a balas: primero el que le quede más tiempo vivo, que es el que
    // de verdad tiene más munición comprometida.
    return items.sort(
      (a, b) => b.boost.bullets - a.boost.bullets || +new Date(b.boost.endsAt) - +new Date(a.boost.endsAt)
    )
  }, [launches, tokens])
}
