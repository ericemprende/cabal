/**
 * Lo que se puede enseñar de un usuario a cualquiera: es lo que viaja en el
 * feed, el leaderboard, los tokens, los launches y la página de perfil.
 *
 * Deliberadamente NO lleva `wallet`, `googleEmail` ni `isAdmin`. Son datos de
 * la cuenta, no del perfil, y esas rutas las puede pedir cualquiera sin sesión.
 * Para el usuario autenticado consigo mismo está `UserDTO`.
 */
export interface PublicUserDTO {
  id: string
  handle: string
  name: string
  avatar: string
  bio?: string | null
  /** Si tiene alguna wallet verificada; la dirección en sí no se expone. */
  walletVerified: boolean
  xHandle?: string | null
  xVerified: boolean
  googleVerified: boolean
  tgHandle?: string | null
  isDev: boolean
  cabalScore: number
  callsWon: number
  callsTotal: number
  followers: number
  points: number
  lifetimePoints: number
  isFollowed?: boolean
}

/** El usuario visto por sí mismo o por el panel de admin: incluye lo privado. */
export interface UserDTO extends PublicUserDTO {
  wallet?: string | null
  googleEmail?: string | null
  isAdmin?: boolean
  /** Correo de la cuenta (seguridad y contacto). Siempre presentes: toUserDTO los rellena con sus defaults. */
  email: string | null
  emailVerified: boolean
  /** Pide un código por correo al entrar con usuario y contraseña. */
  twoFactorEnabled: boolean
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
  user: PublicUserDTO
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
  hidden?: boolean
  submitterRole: 'dev' | 'community' // dev = lo sube el propio dev · community = scout que encontró la info
  contract?: string | null // CA del token desplegado (habilita gráfico en vivo). Antes del lanzamiento es dato premium
  devWallet?: string | null // wallet del dev (dato premium)
  launchpad?: string | null // plataforma donde sale el token (dato premium)
  /** Datos premium que el launch tiene pero quien mira no puede ver (null en su campo). */
  lockedFields: PremiumField[]
  network: string
  launchAt: string
  description: string
  website?: string | null
  twitter?: string | null
  telegram?: string | null
  isLive: boolean // el launch se emite en vivo (streaming)
  liveUrl?: string | null // link del stream (YouTube, Twitch…) para incrustar en el detalle
  status: string // computed: upcoming | live | ended
  hype: number
  hyped: boolean
  lpLocked: boolean
  mintRevoked: boolean
  top10Pct: number
  createdAt: string
  createdBy: PublicUserDTO
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
  /**
   * Su dev, solo si se sabe de verdad: publicó el launch él mismo o lo reclamó y
   * se verificó. null = "dev sin verificar" (lo encontró un scout).
   */
  dev: PublicUserDTO | null
  /** Quien lo publicó en el Radar, si el token salió de ahí. */
  publishedBy: PublicUserDTO | null
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

/** Plataforma de trading afiliada. Pública solo si active && (url o links por red). */
export interface AffiliatePlatformDTO {
  id: string
  name: string
  slug: string
  url: string
  /** Enlace de referido por red: { solana: 'https://gmgn.ai/sol/token/…_{ca}', … } */
  links: Record<string, string>
  active: boolean
  order: number
}

export interface LaunchDetailDTO extends LaunchDTO {
  posts: PostDTO[]
  /** Si quien lo mira puede editarlo: quien lo publicó o un administrador. */
  canEdit: boolean
  /** Equipo del proyecto: invitaciones aceptadas. */
  team: LaunchMemberDTO[]
  /** Invitaciones sin responder. Solo llegan a quien gestiona el equipo. */
  pendingInvites: LaunchMemberDTO[]
  /** Quien mira puede invitar, cambiar roles y quitar gente (el dev o un admin). */
  canManageTeam: boolean
  /** Invitación pendiente de quien mira a este equipo, si la hay. */
  myInvite: LaunchMemberDTO | null
  /** Quien mira ya forma parte del equipo (puede salir). */
  isTeamMember: boolean
}

// ---------- Equipos por launch ----------

export interface LaunchMemberDTO {
  id: string
  role: string
  roleLabel: string
  status: 'pending' | 'accepted' | 'declined' | string
  user: PublicUserDTO
  createdAt: string
}

/** Invitación recibida para unirse al equipo de un launch. */
export interface TeamInviteDTO {
  id: string
  role: string
  roleLabel: string
  createdAt: string
  launch: LaunchRefDTO
  invitedBy: PublicUserDTO
}

// ---------- Plan premium ----------

/** Datos de un launch cuya visibilidad decide el admin. */
export type PremiumField = 'devWallet' | 'launchpad' | 'contract'
/** public: todo el mundo · premium: suscriptores · hidden: solo el equipo del launch y los admins */
export type FieldMode = 'public' | 'premium' | 'hidden'

export interface PremiumStatusDTO {
  active: boolean
  /** De dónde sale el acceso. staff = administrador del sitio. */
  source: 'stripe' | 'nowpayments' | 'admin' | 'staff' | null
  plan: string | null
  /** Hasta cuándo dura el acceso; null = no caduca (o no hay acceso). */
  until: string | null
  /** Suscripción de Stripe que se renovará sola. */
  renews: boolean
  cancelAtPeriodEnd: boolean
  /** Stripe no pudo cobrar la renovación y está reintentando. */
  pastDue: boolean
  /** Tiene cliente en Stripe: puede abrir el portal de facturación. */
  canManageBilling: boolean
}

export interface PremiumPlanDTO {
  key: string
  label: string
  priceUsd: number
  months: number
  perMonthUsd: number
  /** Ahorro frente a pagar el plan mensual todos esos meses (0 si no aplica). */
  savingsPct: number
  card: boolean
  crypto: boolean
}

export interface PremiumInfoDTO {
  loggedIn: boolean
  status: PremiumStatusDTO
  plans: PremiumPlanDTO[]
  fields: Record<PremiumField, FieldMode>
}

/** Emblema del perfil por un hito (fundador, actividad…). Ver lib/badges.ts. */
export interface BadgeDTO {
  id: string
  label: string
  description: string
  /** Clave del icono; el mapeo a un componente de lucide-react vive en el cliente. */
  icon: string
}

export interface LeaderboardEntryDTO {
  rank: number
  user: PublicUserDTO
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
  wallets: WalletLinkDTO[]
  devClaims: DevClaimDTO[]
  emailVerified: boolean
  twoFactorEnabled: boolean
  premium: PremiumStatusDTO
  badges: BadgeDTO[]
}

export interface WalletLinkDTO {
  id: string
  network: string
  address: string
  label: string
  signature: boolean
  createdAt: string
}

/** Métricas on-chain reales de un token verificado (DexScreener/GeckoTerminal/RPC). */
export interface DevClaimStats {
  found: boolean
  name: string
  symbol: string
  priceUsd: number | null
  fdv: number | null
  marketCap: number | null
  liquidityUsd: number | null
  volume24h: number | null
  change24h: number | null
  pairCreatedAt: number | null
  dexId: string
  pairUrl: string
  athPrice: number | null
  athAt: number | null
  athFdv: number | null
  top10Pct: number | null
}

export interface DevClaimDTO {
  id: string
  network: string
  contract: string
  walletAddress: string
  name: string
  symbol: string
  status: 'verified' | 'pending' | string
  note: string
  stats: DevClaimStats | null
  source: string
  createdAt: string
  verifiedAt: string | null
}

/** Código de invitación + estadísticas de referidos del usuario. */
export interface ReferralDTO {
  code: string
  referrals: number
  earned: number
  percent: number
}

/** Reclamo de propiedad de un proyecto de la plataforma (launch o token). */
export interface ProjectClaimDTO {
  id: string
  targetType: 'launch' | 'token' | string
  targetId: string
  network: string
  contract: string
  wallet: string
  status: 'verified' | 'pending' | 'rejected' | string
  method: 'onchain' | 'admin' | 'manual' | string
  note: string
  createdAt: string
  verifiedAt: string | null
  projectName?: string
  projectTicker?: string | null
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

// ---------- Lista de espera (whitelist) ----------
export interface WaitlistEntryDTO {
  id: string
  position: number
  xId: string
  xHandle: string
  xName: string
  xAvatar: string | null
  xFollowers: number
  xVerified: boolean
  xCreatedAt: string | null
  userId: string | null
  email: string
  telegram: string
  wallet: string
  country: string
  reason: string
  completed: boolean
  completedAt: string | null
  status: string
  shared: boolean
  sharedAt: string | null
  referredBy: string | null
  note: string
  createdAt: string
  approvedAt: string | null
}

export interface AdminWaitlistDTO {
  entries: WaitlistEntryDTO[]
  stats: {
    total: number
    pending: number
    approved: number
    rejected: number
    shared: number
    incomplete: number
  }
}

// ---------- Perfil público (/u/<handle>) ----------

/** Launch publicado por el usuario, en la lista de proyectos de su perfil. */
export interface ProfileLaunchDTO extends LaunchRefDTO {
  status: string
  hype: number
}

/** Token del que el usuario es dev (lo publicó él o lo reclamó y se verificó). */
export interface ProfileTokenDTO {
  id: string
  name: string
  ticker: string
  emoji: string
  image?: string | null
  network: string
  mc: number
  athMc: number
  change24h: number
  isRug: boolean
  launchedAt: string
}

export interface PublicProfileDTO {
  user: PublicUserDTO
  joinedAt: string
  /** Si quien lo mira es el propio usuario: cambia "Seguir" por "Editar perfil". */
  isMe: boolean
  /** Tiene el plan Premium activo ahora mismo (para la coronita). */
  premium: boolean
  badges: BadgeDTO[]
  counts: {
    followers: number
    following: number
    posts: number
    theses: number
    launches: number
    tokens: number
  }
  launches: ProfileLaunchDTO[]
  tokens: ProfileTokenDTO[]
  /** Tokens externos verificados on-chain como suyos. */
  devClaims: DevClaimDTO[]
  posts: PostDTO[]
}

// ---------- Admin: premium, pagos e integraciones ----------

/** Usuario resumido en las tablas del panel. */
export interface AdminUserRefDTO {
  id: string
  handle: string
  name: string
  avatar: string
}

export interface AdminSubscriptionDTO {
  id: string
  user: AdminUserRefDTO
  provider: string
  plan: string
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  note: string
  createdAt: string
  /** Da acceso ahora mismo. */
  active: boolean
}

export interface AdminPaymentDTO {
  id: string
  user: AdminUserRefDTO
  provider: string
  plan: string
  amountUsd: number
  status: string
  payCurrency: string | null
  actuallyPaid: number | null
  createdAt: string
}

export interface AdminPremiumDTO {
  settings: {
    fields: Record<PremiumField, FieldMode>
    prices: Record<string, number | null>
  }
  providers: {
    stripe: { configured: boolean; webhookSecret: boolean; products: Record<string, boolean>; webhookUrl: string }
    nowpayments: { configured: boolean; sandbox: boolean; ipnUrl: string }
  }
  stats: { activeUsers: number; stripe: number; crypto: number; admin: number; revenue30d: number }
  subscriptions: AdminSubscriptionDTO[]
  payments: AdminPaymentDTO[]
}

export interface AdminIntegrationsDTO {
  ghl: {
    configured: boolean
    tag: string
    workflow: boolean
    synced: number
    /** Con correo pero aún sin enviar al CRM. */
    pending: number
    failed: number
    lastError: string | null
  }
  email: { configured: boolean; provider: string | null; from: string | null }
  security: {
    twoFactorRequired: boolean
    twoFactorUsers: number
    verifiedEmails: number
    withoutEmail: number
  }
}
