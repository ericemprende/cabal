export interface UserDTO {
  id: string
  handle: string
  name: string
  avatar: string
  bio?: string | null
  wallet?: string | null
  walletVerified: boolean
  xHandle?: string | null
  xVerified: boolean
  googleEmail?: string | null
  googleVerified: boolean
  tgHandle?: string | null
  isDev: boolean
  isAdmin?: boolean
  cabalScore: number
  callsWon: number
  callsTotal: number
  followers: number
  points: number
  lifetimePoints: number
  isFollowed?: boolean
}

export interface LaunchRefDTO {
  id: string
  name: string
  ticker: string | null
  emoji: string
  image?: string | null
  isPrivate: boolean
  network: string
  launchAt: string
}

export interface TokenRefDTO {
  id: string
  name: string
  ticker: string
  emoji: string
  image?: string | null
  network: string
  mc: number
}

export interface PostDTO {
  id: string
  kind: string
  content: string
  likes: number
  liked: boolean
  pnl?: number | null
  createdAt: string
  user: UserDTO
  launch?: LaunchRefDTO | null
  token?: TokenRefDTO | null
  pointsEarned?: number
}

export interface LaunchDTO {
  id: string
  name: string
  ticker: string | null
  emoji: string
  image?: string | null
  banner?: string | null
  isPrivate: boolean
  network: string
  launchAt: string
  description: string
  website?: string | null
  twitter?: string | null
  telegram?: string | null
  status: string // computed: upcoming | live | ended
  hype: number
  hyped: boolean
  lpLocked: boolean
  mintRevoked: boolean
  top10Pct: number
  createdAt: string
  createdBy: UserDTO
  postsCount: number
}

export interface TokenDTO {
  id: string
  name: string
  ticker: string
  emoji: string
  image?: string | null
  network: string
  price: number
  mc: number
  change24h: number
  volume24h: number
  holders: number
  top10Pct: number
  contract: string
  launchedAt: string
  athMc: number
  isRug: boolean
  dev: UserDTO
  postsCount: number
}

export interface TokenDetailDTO extends TokenDTO {
  chart: { t: number; p: number }[]
  posts: PostDTO[]
  devHistory: {
    id: string
    name: string
    ticker: string
    emoji: string
    mc: number
    athMc: number
    change24h: number
    isRug: boolean
    launchedAt: string
  }[]
  devStats: { tokensLaunched: number; rugs: number; avgPerformance: number }
}

export interface PointEventDTO {
  id: string
  amount: number
  reason: string
  note?: string | null
  createdAt: string
}

export interface LaunchDetailDTO extends LaunchDTO {
  posts: PostDTO[]
}

export interface LeaderboardEntryDTO {
  rank: number
  user: UserDTO
  metric: number // cabalScore or points or winrate-based
  winRate?: number
}

export interface ClanDTO {
  id: string
  name: string
  emoji: string
  members: number
  score: number
  trend: number
  tag: string
}

export interface LeaderboardDTO {
  callers: LeaderboardEntryDTO[]
  devs: LeaderboardEntryDTO[]
  points: LeaderboardEntryDTO[]
  clans: ClanDTO[]
}

export interface MeDTO extends UserDTO {
  isAdmin: boolean
  pointsRank?: number
  nextRedeemAt?: string | null
  pointEvents: PointEventDTO[]
  pointRules: Record<string, number>
  stats: { postsCount: number; launchesCount: number; hypesGiven: number; likesReceived: number }
}

export interface AdminOverviewDTO {
  totalUsers: number
  totalPosts: number
  totalLaunches: number
  totalTokens: number
  pointsInCirculation: number
  pointsIssuedTotal: number
  pendingRedeems: number
  topEarners: { user: UserDTO; points: number }[]
  recentEvents: (PointEventDTO & { user: UserDTO })[]
  distribution: { reason: string; total: number }[]
}

export interface AdminUserRowDTO extends UserDTO {
  postsCount: number
  launchesCount: number
  likesReceived: number
  lastActivity?: string | null
}
