import { db } from '@/lib/db'
import { computeLaunchStatus } from '@/lib/api-helpers'
import type { PostDTO, PublicUserDTO, UserDTO } from '@/lib/types'

type DbUser = {
  id: string
  handle: string
  name: string
  avatar: string
  bio: string | null
  wallet: string | null
  walletVerified: boolean
  xHandle: string | null
  xVerified: boolean
  googleEmail: string | null
  googleVerified: boolean
  tgHandle: string | null
  isDev: boolean
  isAdmin: boolean
  cabalScore: number
  callsWon: number
  callsTotal: number
  followers: number
  points: number
  lifetimePoints: number
  repUp: number
  repDown: number
  repScore: number
  email?: string | null
  emailVerified?: boolean
  twoFactorEnabled?: boolean
  notifyEmail?: boolean
  verified?: boolean
  verifiedVia?: string | null
}

/**
 * Versión pública del usuario. Es la que deben usar todas las rutas abiertas
 * (feed, leaderboard, tokens, launches, perfil): omite la wallet, los correos
 * y la marca de admin.
 */
export function toPublicUserDTO(u: DbUser, isFollowed?: boolean): PublicUserDTO {
  return {
    id: u.id,
    handle: u.handle,
    name: u.name,
    avatar: u.avatar,
    bio: u.bio,
    walletVerified: u.walletVerified,
    xHandle: u.xHandle,
    xVerified: u.xVerified,
    googleVerified: u.googleVerified,
    tgHandle: u.tgHandle,
    isDev: u.isDev,
    cabalScore: u.cabalScore,
    callsWon: u.callsWon,
    callsTotal: u.callsTotal,
    followers: u.followers,
    points: u.points,
    lifetimePoints: u.lifetimePoints,
    reputation: {
      score: u.repScore,
      up: u.repUp,
      down: u.repDown,
      votes: u.repUp + u.repDown,
    },
    verified: u.verified ?? false,
    isFollowed,
  }
}

/**
 * Versión completa, con los campos privados. Reservada para /api/me y para el
 * panel de admin: no la uses en una ruta que pueda pedir cualquiera.
 */
export function toUserDTO(u: DbUser, isFollowed?: boolean): UserDTO {
  return {
    ...toPublicUserDTO(u, isFollowed),
    wallet: u.wallet,
    googleEmail: u.googleEmail,
    isAdmin: u.isAdmin,
    email: u.email ?? null,
    emailVerified: u.emailVerified ?? false,
    twoFactorEnabled: u.twoFactorEnabled ?? false,
    notifyEmail: u.notifyEmail ?? true,
  }
}

export async function toPostDTO(
  p: {
    id: string
    kind: string
    content: string
    likes: number
    pnl: number | null
    createdAt: Date
    user: DbUser
    launchId: string | null
    tokenId: string | null
    contract?: string | null
    network?: string | null
  },
  liked: boolean,
  pointsEarned?: number
): Promise<PostDTO> {
  let launch = null as PostDTO['launch']
  let token = null as PostDTO['token']
  if (p.launchId) {
    const l = await db.launch.findUnique({ where: { id: p.launchId } })
    if (l)
      launch = {
        id: l.id,
        name: l.name,
        ticker: l.isPrivate ? null : l.ticker,
        emoji: l.emoji,
        image: l.image,
        isPrivate: l.isPrivate,
        network: l.network,
        launchAt: l.launchAt.toISOString(),
        verified: l.verified,
      }
  }
  if (p.tokenId) {
    const t = await db.token.findUnique({ where: { id: p.tokenId } })
    if (t)
      token = {
        id: t.id,
        name: t.name,
        ticker: t.ticker,
        emoji: t.emoji,
        image: t.image,
        network: t.network,
        mc: t.mc,
      }
  }
  return {
    id: p.id,
    kind: p.kind,
    content: p.content,
    likes: p.likes,
    liked,
    pnl: p.pnl,
    createdAt: p.createdAt.toISOString(),
    user: toPublicUserDTO(p.user),
    launch,
    token,
    contract: p.contract ?? null,
    network: p.network ?? null,
    pointsEarned,
  }
}

export { computeLaunchStatus }
