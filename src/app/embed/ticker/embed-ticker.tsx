'use client'

import { useQuery } from '@tanstack/react-query'
import { jsonFetch } from '@/lib/api-client'
import { EmbedBar, type TickerLogo, type TickerSpeed } from '@/components/cabal/ticker'
import type { TokenDTO } from '@/lib/types'

export function EmbedTicker({
  ids,
  speed,
  solid,
  logo,
}: {
  ids: string[]
  speed: TickerSpeed
  solid: boolean
  logo: TickerLogo
}) {
  // Se deja abierto horas en OBS: refresca los precios cada minuto.
  const { data } = useQuery<TokenDTO[]>({
    queryKey: ['embed-ticker'],
    queryFn: () => jsonFetch('/api/tokens?sort=trending&network=all'),
    refetchInterval: 60_000,
  })
  const all = data ?? []
  // En el orden en que se eligieron.
  const tokens = ids.length ? ids.map((id) => all.find((t) => t.id === id)).filter((t): t is TokenDTO => !!t) : all

  return (
    <>
      {/* El layout pinta el fondo de la app; aquí tiene que verse lo que haya detrás. */}
      <style>{`html,body{background:${solid ? '#0d0e0a' : 'transparent'} !important;overflow:hidden}`}</style>
      <div className="h-screen w-screen">
        <EmbedBar tokens={tokens} speed={speed} logo={logo} />
      </div>
    </>
  )
}
