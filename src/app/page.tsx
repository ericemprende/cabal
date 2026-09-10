import type { Metadata } from 'next'
import { WhitelistLanding } from '@/components/cabal/whitelist-landing'
import { buildShareMetadata, parseHandle } from '@/lib/share-metadata'
import { toLocale } from '@/lib/waitlist'

/**
 * Home pública de cabal.army mientras el proyecto no ha abierto: la landing de
 * la lista de espera (whitelist). La plataforma en sí vive en /app hasta el
 * lanzamiento público.
 *
 * Los enlaces de invitación se comparten ahora como /r/<handle> (ver
 * app/r/[handle]). Aquí se siguen atendiendo los antiguos /?ref=<handle> para
 * no romper los que ya están publicados.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; l?: string | string[] }>
}): Promise<Metadata> {
  const { ref, l } = await searchParams
  return buildShareMetadata(parseHandle(ref), toLocale(Array.isArray(l) ? l[0] : l))
}

export default function Page() {
  return <WhitelistLanding />
}
