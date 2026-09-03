import { db } from '@/lib/db'
import { computeLaunchStatus } from '@/lib/api-helpers'
import type { PostDTO, UserDTO } from '@/lib/types'

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
}

export function toUserDTO(u: DbUser, isFollowed?: boolean): UserDTO {
  return {
    id: u.id,
    handle: u.handle,
    name: u.name,
    avatar: u.avatar,
    bio: u.bio,
    wallet: u.wallet,
    walletVerified: u.walletVerified,
    xHandle: u.xHandle,
    xVerified: u.xVerified,
    googleEmail: u.googleEmail,
    googleVerified: u.googleVerified,
    tgHandle: u.tgHandle,
    isDev: u.isDev,
    isAdmin: u.isAdmin,
    cabalScore: u.cabalScore,
    callsWon: u.callsWon,
    callsTotal: u.callsTotal,
    followers: u.followers,
    points: u.points,
    lifetimePoints: u.lifetimePoints,
    isFollowed,
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
    user: toUserDTO(p.user),
    launch,
    token,
    pointsEarned,
  }
}

export { computeLaunchStatus }
