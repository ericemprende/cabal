import type { Metadata } from 'next'
import { ProfileView } from '@/components/cabal/profile-view'
import { parseHandle } from '@/lib/share-metadata'

/**
 * Perfil público: /u/<handle>. Los datos los pide el cliente (ProfileView) a
 * /api/users/<handle>, para que seguir o dejar de seguir se refleje al momento.
 */
type Params = Promise<{ handle: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params
  const clean = parseHandle(decodeURIComponent(handle)) ?? handle
  return {
    title: `@${clean} en Cabal`,
    description: `Perfil de @${clean} en Cabal: sus proyectos, tesis y reputación como dev y como scout.`,
    alternates: { canonical: `/u/${clean}` },
  }
}

export default async function UserProfilePage({ params }: { params: Params }) {
  const { handle } = await params
  return <ProfileView handle={decodeURIComponent(handle).replace(/^@+/, '')} />
}
