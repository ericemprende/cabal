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
  discordVerified: boolean
  tgHandle?: string | null
  isDev: boolean
  cabalScore: number
  callsWon: number
  callsTotal: number
  followers: number
  points: number
  lifetimePoints: number
  /** Reputación de la comunidad (👍/👎). Va en el usuario público para poder
   *  enseñar la insignia donde aparezca, sobre todo en el dev de un launch. */
  reputation: ReputationSummaryDTO
  /** Verificación oficial de Cabal (insignia + destello en el avatar). */
  verified: boolean
  isFollowed?: boolean
}

/** Resumen de la reputación de un usuario. Ver lib/reputation.ts. */
export interface ReputationSummaryDTO {
  /** % de confianza ponderado y suavizado (0-100). */
  score: number
  up: number
  down: number
  /** up + down: por debajo de REP_MIN_VOTES no se enseña el porcentaje. */
  votes: number
}

/** Una valoración escrita, tal y como se lista en el perfil. */
export interface ReputationReviewDTO {
  id: string
  value: 1 | -1
  body: string
  createdAt: string
  /** true si la reseña se editó después de publicarla. */
  edited: boolean
  author: {
    id: string
    handle: string
    name: string
    avatar: string
    walletVerified: boolean
    xVerified: boolean
  }
}

/** GET /api/users/<handle>/reputation */
export interface ReputationDTO {
  summary: ReputationSummaryDTO
  /** Valoraciones con texto, las más nuevas primero. */
  reviews: ReputationReviewDTO[]
  /** Cuántas valoraciones más con texto hay sin cargar. */
  more: number
  /** Voto de quien mira, si ya votó. */
  mine: { value: 1 | -1; body: string } | null
  /** Puede votar a este usuario: con sesión, Premium, verificado y no siendo él mismo. */
  canVote: boolean
  /** Por qué no puede votar, para explicarlo en vez de esconder los botones. */
  reason: 'ok' | 'anon' | 'self' | 'unverified' | 'premium'
}

/** El usuario visto por sí mismo o por el panel de admin: incluye lo privado. */
export interface UserDTO extends PublicUserDTO {
  wallet?: string | null
  googleEmail?: string | null
  /** Nombre visible de Discord. El id nunca sale del servidor. */
  discordName?: string | null
  isAdmin?: boolean
  /** Correo de la cuenta (seguridad y contacto). Siempre presentes: toUserDTO los rellena con sus defaults. */
  email: string | null
  emailVerified: boolean
  /** Pide un código por correo al entrar con usuario y contraseña. */
  twoFactorEnabled: boolean
  /** Avisos Premium de lanzamientos por correo (10 y 5 min antes). */
  notifyEmail: boolean
  showTrackRecord: boolean
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
  verified?: boolean
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

/**
 * El post al que contesta una respuesta, con lo justo para citarlo: quién lo
 * escribió, un extracto y el token/CA del que hablaba. Así "le entré, me
 * gusta" deja de ser un comentario huérfano en el feed.
 */
export interface PostParentDTO {
  id: string
  kind: string
  /** Extracto del original (recortado en el servidor). */
  content: string
  user: { name: string; handle: string; avatar?: string | null; verified?: boolean }
  /** Ticker del token del que iba el original, si se sabe. */
  ticker?: string | null
  image?: string | null
  contract?: string | null
  network?: string | null
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
  contract?: string | null
  network?: string | null
  /** Si el post es una respuesta, el original citado (null = post suelto). */
  parent?: PostParentDTO | null
  /** Crítica (kind = "fud") de la que su autor ya se retractó. */
  retracted?: boolean
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
  /** false = fecha estimada, aún no confirmada por quien sube el proyecto. */
  dateConfirmed: boolean
  /** Cuándo fue la última edición con cambios de verdad (null = nunca se editó). */
  lastEditedAt?: string | null
  /** Qué cambió en esa edición, en texto corto ("confirmó la fecha de lanzamiento"). */
  lastChangeNote?: string | null
  /** La última edición la hizo la administración, no quien publicó el launch. */
  lastEditedByAdmin?: boolean
  description: string
  website?: string | null
  twitter?: string | null
  telegram?: string | null
  isLive: boolean // el launch se emite en vivo (streaming)
  liveUrl?: string | null // link del stream (YouTube, Twitch…) para incrustar en el detalle
  status: string // computed: upcoming | live | ended
  hype: number
  hyped: boolean
  /** Votos en contra ("popó"), cada uno con su motivo publicado en el hilo. */
  fud: number
  /** Quien mira votó en contra (puede retractarse pulsando otra vez). */
  fudded: boolean
  lpLocked: boolean
  mintRevoked: boolean
  top10Pct: number
  /** Launch oficial verificado por Cabal (frente a clones). */
  verified: boolean
  /** Solo en el panel de admin: admin | premium. */
  verifiedVia?: string | null
  createdAt: string
  createdBy: PublicUserDTO
  postsCount: number
  /** Munición viva sobre este launch (null = nadie le ha disparado). */
  boost?: BoostScoreDTO | null
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
  /** Token oficial: marcado por el admin o salido de un launch verificado. */
  verified: boolean
  /** Solo en el panel de admin: marcado en el propio token (no heredado del launch). */
  verifiedSelf?: boolean
  /**
   * Su dev, solo si se sabe de verdad: publicó el launch él mismo o lo reclamó y
   * se verificó. null = "dev sin verificar" (lo encontró un scout).
   */
  dev: PublicUserDTO | null
  /** Quien lo publicó en el Radar, si el token salió de ahí. */
  publishedBy: PublicUserDTO | null
  postsCount: number
  /** Munición viva sobre este token (null = nadie le ha disparado). */
  boost?: BoostScoreDTO | null
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

export interface LaunchChangeDTO {
  id: string
  /** Qué cambió, en texto corto ("Cambió la fecha de lanzamiento, actualizó los enlaces"). */
  note: string
  createdAt: string
  /** Quién lo cambió; null = la administración. */
  by: { name: string; handle: string } | null
}

export interface LaunchDetailDTO extends LaunchDTO {
  posts: PostDTO[]
  /** Historial de ediciones, de la más nueva a la más vieja. */
  changes: LaunchChangeDTO[]
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
  /** Lo mismo en USD: mensual × meses − precio del plan (0 si no aplica). */
  savingsUsd: number
  /** Lo que costarían esos meses pagando el mensual; null si no hay ahorro. */
  fullPriceUsd: number | null
  card: boolean
  crypto: boolean
  /** Munición de regalo al activar el plan (ver lib/ammo.ts). 0 = no regala. */
  ammoBullets: number
}

export interface PremiumInfoDTO {
  loggedIn: boolean
  status: PremiumStatusDTO
  plans: PremiumPlanDTO[]
  fields: Record<PremiumField, FieldMode>
}

/** Emblema del perfil por un hito (fundador, actividad…). Ver lib/badges.ts. */
/** El metal de una insignia: dice el nivel. Fundador va aparte, no es un rango. */
export type BadgeMetal = 'bronce' | 'acero' | 'oro' | 'obsidiana' | 'verde' | 'fundador'

export interface BadgeDTO {
  id: string
  label: string
  description: string
  /** Igual que `silueta`. Se mantiene por los clientes que aún leen este campo. */
  icon: string
  /** Silueta de la chapa; las claves viven en lib/siluetas. */
  silueta: string
  metal: BadgeMetal
  /** 1 a 4: cuántos remaches se encienden. 0 en Fundador, que no es un rango. */
  rango: number
}

export interface LeaderboardEntryDTO {
  rank: number
  user: PublicUserDTO
  metric: number // cabalScore or points or winrate-based
  winRate?: number
  /** Solo en Top Callers: resumen de sus calls en el periodo elegido. */
  calls?: CallSummaryDTO
}

export interface CallSummaryDTO {
  score: number
  calls: number
  wins: number
  winRate: number
  bestMultiple: number | null
  avgPeak: number | null
}

/** Una call con su resultado guardado (perfil → estadísticas). */
export interface CallRowDTO {
  id: string
  content: string
  network: string
  contract: string
  symbol: string | null
  image: string | null
  entryMc: number | null
  peakMultiple: number | null
  currentMultiple: number | null
  points: number
  final: boolean
  createdAt: string
}

export interface UserCallStatsDTO {
  period: '24h' | '7d' | '30d' | 'all'
  summary: CallSummaryDTO
  /** Posición en Top Callers en ese periodo (null si no tiene calls con resultado). */
  rank: number | null
  best: CallRowDTO[]
  calls: CallRowDTO[]
  /** Calls publicadas cuyo resultado aún no se ha calculado. */
  pending: number
}

/**
 * Un "clan" es una comunidad real de Telegram o Discord que ya usa el bot de
 * Cabal: no hay que crear nada dentro de Cabal, la comunidad se trae como está.
 */
export interface ClanDTO {
  /** Clave de la comunidad ("telegram:-100123"), también filtra Top Callers. */
  key: string
  name: string
  provider: 'telegram' | 'discord'
  /** Chats con el bot (en Discord, canales del mismo servidor). */
  chats: number
  members: number | null
  /** Cuántos de esos miembros tienen cuenta en Cabal. null = aún sin calcular. */
  cabalMembers: number | null
  online: number | null
  /** Foto del grupo, canal o servidor. null = enseña el icono del proveedor. */
  image: string | null
  /** Enlace público para unirse, si la comunidad tiene uno. */
  link: string | null
  /** Cuánta gente distinta ha dado calls ahí. */
  callers: number
  score: number
  calls: number
  wins: number
  winRate: number
  bestMultiple: number | null
  avgPeak: number | null
  /** Quiénes sostienen el clan: sus mejores callers. */
  topCallers: { handle: string; name: string; avatar: string; score: number; bestMultiple: number | null }[]
  lastCallAt: string | null
}

/** Grupo o servidor con el bot, para filtrar Top Callers por comunidad. */
export interface CommunityDTO {
  key: string
  label: string
  provider: 'telegram' | 'discord'
  calls: number
}

export interface LeaderboardDTO {
  period: '24h' | '7d' | '30d' | 'all'
  /** Comunidad por la que está filtrado Top Callers (null = todo Cabal). */
  community: string | null
  /** Comunidades que han dado alguna call, para el selector. */
  communities: CommunityDTO[]
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
  /** El siguiente rango de cada familia que aún no tiene: sus objetivos. */
  nextBadges?: BadgeDTO[]
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
  /** Última visita con la sesión abierta; null si no ha entrado desde que se registra. */
  lastSeenAt?: string | null
  /** Fecha de registro de la cuenta. */
  createdAt?: string | null
  contactEmail: string | null
  shared: boolean
  xFollowers: number | null
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

// ---------- Comprar sin salir de Cabal (Solana, vía la API de Jupiter) ----------
export interface SwapConfigDTO {
  enabled: boolean
  solMint: string
  /** null = el botón funciona igual, pero todavía sin comisión para Cabal. */
  fee: {
    referralAccount: string
    feeBps: number
    /** Por debajo de este monto en USD se cobra smallTradeFeeBps en vez de feeBps. 0 = sin mínima. */
    smallTradeUsd: number
    smallTradeFeeBps: number
    /** Texto para mostrarle a la comunidad (ej. "comisión mínima en operaciones chiquitas"). */
    note: string
  } | null
}

/** Comisión de swap de una red, tal como la edita el admin. */
export interface SwapFeeConfigDTO {
  network: string
  enabled: boolean
  feeBps: number
  smallTradeUsd: number
  smallTradeFeeBps: number
  referralAccount: string
  feeWallet: string
  note: string
}

export interface SwapFeeTotalsDTO {
  feeUsd: number
  volumeUsd: number
  trades: number
}

/** Lo que llevan generado las comisiones de compra/venta (panel de admin). */
export interface SwapFeeEarningsDTO {
/** Fuentes de ingreso de Cabal (/admin → Ingresos). */
export type RevenueSource = 'premium' | 'ammo' | 'donations' | 'launch' | 'swap'

/** Todos los ingresos juntos, en dólares, por fuente. */
export interface RevenueDTO {
  /** Precio de SOL usado para pasar a dólares las comisiones de lanzamiento (0 = no se pudo leer). */
  solUsd: number
  range: { from: string; to: string; bySource: Record<RevenueSource, number> }
  all: Record<RevenueSource, number>
  last30d: Record<RevenueSource, number>
  last7d: Record<RevenueSource, number>
  series: ({ date: string } & Record<RevenueSource, number>)[]
  recent: { source: RevenueSource; at: string; usd: number; label: string; who: string | null }[]
}

  all: SwapFeeTotalsDTO
  last30d: SwapFeeTotalsDTO
  last7d: SwapFeeTotalsDTO
  last24h: SwapFeeTotalsDTO
  /** El periodo consultado (from/to incluidos). Red, tipo, serie, últimas y pendientes son de este periodo. */
  range: SwapFeeTotalsDTO & { from: string; to: string }
  /** Swaps firmados que nunca confirmaron: parte se cobró, parte no. */
  pending: SwapFeeTotalsDTO
  byNetwork: (SwapFeeTotalsDTO & { network: string })[]
  byKind: (SwapFeeTotalsDTO & { kind: string })[]
  series: { date: string; feeUsd: number }[]
  recent: {
    id: string
    network: string
    kind: string
    walletAddress: string
    mint: string
    amountUsd: number
    feeUsd: number
    createdAt: string
  }[]
}

export interface FeeBalanceDTO {
  token: string
  label: string
  amount: number
  /** null = sin liquidez para cotizarlo: hay saldo, pero no precio honesto. */
  usd: number | null
}

export interface NetworkTreasuryDTO {
  network: string
  payee: string
  balances: FeeBalanceDTO[]
  usdTotal: number
  unpriced: number
  error: string | null
}

/** Saldo real sin reclamar en las cuentas de comisiones, leido on-chain. */
export interface SwapTreasuryDTO {
  networks: NetworkTreasuryDTO[]
  usdTotal: number
  unpriced: number
  checkedAt: string
}

export interface SerializedTxDTO {
  kind: 'legacy' | 'versioned'
  base64: string
}

export interface BuildBuyDTO {
  ok: boolean
  /** Solo en la primerísima compra de Cabal de este token: crea la cuenta donde cae la comisión. */
  createFeeAccountTx: SerializedTxDTO | null
  swapTransaction: SerializedTxDTO
  outAmount: string
  lamportsIn: string
  priceImpactPct: string
  /** Pásalo a POST /api/swap/confirm con la firma, una vez la transacción esté en la red. null = sin comisión configurada. */
  intentId: string | null
}

export interface BuildSellDTO {
  ok: boolean
  /** Solo si nadie vendió antes ese token por Cabal (o compró recibiendo SOL): crea la cuenta de comisión. */
  createFeeAccountTx: SerializedTxDTO | null
  swapTransaction: SerializedTxDTO
  outAmount: string
  amountIn: string
  priceImpactPct: string
  intentId: string | null
}

export interface TokenBalanceDTO {
  amount: string
  decimals: number
  uiAmount: number
}

// ---------- Comprar sin salir de Cabal en redes EVM (Ethereum/Base/BSC, vía la API de 0x) ----------

/** Transacción cruda a firmar con una wallet EVM (MetaMask u otro proveedor EIP-1193). */
export interface EvmTxToSignDTO {
  to: string
  data: string
  value: string
  chainId: number
}

/** Typed data de Permit2 a firmar con eth_signTypedData_v4 antes de mandar la transacción (null si 0x no lo pidió). */
export interface Permit2Eip712DTO {
  types: Record<string, { name: string; type: string }[]>
  domain: Record<string, unknown>
  message: Record<string, unknown>
  primaryType: string
}

export interface BuildBuyEvmDTO {
  ok: boolean
  transaction: EvmTxToSignDTO
  permit2Eip712: Permit2Eip712DTO | null
  buyAmount: string
  intentId: string | null
}

// ---------- Perfil público (/u/<handle>) ----------

/** Launch publicado por el usuario, en la lista de proyectos de su perfil. */
export interface ProfileLaunchDTO extends LaunchRefDTO {
  status: string
  hype: number
  /** Votos en contra (💩). */
  fud: number
  /** Comentarios en el hilo del launch. */
  comments: number
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
  /** Es la cuenta oficial de Cabal (la que firma avisos y proyectos avalados). */
  official: boolean
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

// ---------- Chat en vivo ----------
export interface ChatMessageDTO {
  id: string
  body: string
  createdAt: string
  /** Sala de la que es el mensaje: "es" | "en" (ver lib/chat-rooms.ts). */
  room: string
  /** Aviso automático de Cabal (ver lib/chat-announce.ts), no lo escribió nadie. */
  system: boolean
  /** Botón del aviso: "donate" abre el diálogo de donaciones, o una ruta/URL. */
  linkUrl: string | null
  linkLabel: string | null
  user: {
    id: string
    name: string
    handle: string
    avatar: string
    walletVerified: boolean
  }
  /** Mensaje al que responde (cita corta), o null si no es respuesta. */
  replyTo: { id: string; body: string; user: { id: string; name: string; handle: string } } | null
  /** Ids de quienes le dieron "me gusta" (corazón). */
  likedBy: string[]
}

/** Panel admin → Chat en vivo: el aviso automático que se repite cada X horas. */
export interface AdminChatAnnounceDTO {
  enabled: boolean
  /** Cada cuántas horas se repite (1–720). */
  hours: number
  body: string
  /** El mismo aviso para la sala en inglés del chat. */
  bodyEn: string
  /** "donate" (diálogo de donaciones), una ruta interna, una URL https, o "" sin botón. */
  linkUrl: string
  linkLabel: string
  linkLabelEn: string
  /** No repetirlo si nadie ha escrito en el chat desde el último aviso. */
  onlyIfActive: boolean
  lastAt: string | null
  /** Cuándo tocaría el siguiente (null si nunca se ha enviado). */
  nextAt: string | null
}

/** Solicitud de verificación oficial (perk Premium). */
export interface VerifyRequestDTO {
  id: string
  kind: 'user' | 'launch'
  note: string
  status: 'pending' | 'approved' | 'rejected' | string
  createdAt: string
  reviewedAt: string | null
  launch: { id: string; name: string; ticker: string | null } | null
  /** Solo en el panel de admin: quien la pide. */
  user: { id: string; handle: string; name: string; avatar: string } | null
}

/** Salud del servidor (panel de admin → GET /api/admin/metrics). */
export interface AdminMetricsDTO {
  minutes: number
  points: {
    at: string
    /** Consultas a Postgres por minuto en ese tramo. */
    dbPerMin: number
    dbAvgMs: number
    /** Peticiones a APIs de fuera por minuto. */
    extPerMin: number
    extAvgMs: number
    extErr: number
    rssMb: number | null
    online: number | null
    lagMs: number | null
  }[]
  /** Peticiones por servicio de fuera en toda la ventana. */
  services: { name: string; calls: number }[]
  now: {
    rssMb: number | null
    heapMb: number | null
    online: number | null
    lagMs: number | null
    dbPerMin: number
    extPerMin: number
    extErrLastHour: number
  }
}

// ---------- Munición y boosts ----------

/** Sobre qué se puede disparar munición. */
export type BoostTarget = 'launch' | 'token'

/** Lo que el admin configura del sistema de munición (ver lib/ammo.ts). */
export interface AmmoSettings {
  /** USD por cargador; null = ese cargador no está a la venta. */
  prices: Record<string, number | null>
  /** Balas que regala cada plan Premium al activarse. */
  planGifts: Record<string, number>
  /** Balas vivas a partir de las cuales el proyecto se pinta de oro. */
  goldenAt: number
  /** Balas de un disparo a partir de las cuales avisan los bots. */
  notifyAt: number
  /** Descuento de lanzamiento sobre el precio de lista, 0-90 %. 0 = sin promo. */
  promoPct: number
  /** Cuándo acaba la promo (ISO). null = no caduca. */
  promoUntil: string | null
}

/** Un cargador a la venta, tal y como se le enseña a quien va a comprar. */
export interface AmmoPackDTO {
  key: string
  label: string
  bullets: number
  priceUsd: number
  /** Las balas en horas de proyecto destacado (una bala = un minuto). */
  hours: number
  /** Lo que costarían esas balas al precio del cargador pequeño; null si no hay ahorro. */
  fullPriceUsd: number | null
  savingsPct: number
  card: boolean
  crypto: boolean
}

/** Munición viva sobre un proyecto: lo que lo sube en el Radar. */
export interface BoostScoreDTO {
  bullets: number
  endsAt: string
  /** Balas disparadas en total: con las que quedan da lo lleno que está el cargador. */
  lifetime: number
  shooters: number
  golden: boolean
  /** El último que recargó, para enseñar su cara cuando entra munición. */
  lastShooter: { handle: string; name: string; avatar: string } | null
  lastShotAt: string
}

export interface BoostDTO {
  id: string
  targetType: BoostTarget
  targetId: string
  bullets: number
  startedAt: string
  endsAt: string
}

export interface AmmoInfoDTO {
  loggedIn: boolean
  /** Balas que le quedan a quien mira. */
  balance: number
  packs: AmmoPackDTO[]
  goldenAt: number
  /** Balas que regala cada plan, para invitar a Premium desde el propio diálogo. */
  planGifts: Record<string, number>
  /** Promoción de lanzamiento viva: descuento y hasta cuándo (null = sin promo). */
  promo: { pct: number; until: string | null } | null
}

/** Panel de admin: todo lo de la munición en una pantalla. */
export interface AdminAmmoDTO {
  settings: AmmoSettings
  /** Los cargadores que existen, con sus balas (el precio sale de settings). */
  packs: { key: string; label: string; bullets: number }[]
  /** Hay producto de Stripe para cobrar munición con tarjeta. */
  cardAvailable: boolean
  stats: {
    bulletsSold30d: number
    revenue30d: number
    /** Balas compradas y todavía sin disparar, en todas las cuentas. */
    bulletsCirculating: number
    /** Proyectos con munición viva ahora mismo. */
    activeBoosts: number
  }
  boosts: {
    id: string
    user: AdminUserRefDTO
    targetType: string
    targetId: string
    targetName: string
    bullets: number
    bulletsLeft: number
    endsAt: string
    createdAt: string
  }[]
}

/** Track record de trading de un usuario (operaciones hechas desde Cabal). */
export interface TrackRecordDTO {
  /** false = el usuario no lo hizo público y quien mira no es él. */
  visible: boolean
  isMe: boolean
  /** Si el dueño lo tiene activado como público. */
  public: boolean
  wallets: { network: string; address: string; label: string; trades: number; volumeUsd: number; netUsd: number }[]
  summary: {
    trades: number
    buys: number
    sells: number
    buyUsd: number
    sellUsd: number
    volumeUsd: number
    /** Ventas − compras en el periodo; no cuenta lo que siga en cartera. */
    netUsd: number
    tokens: number
    avgTradeUsd: number
    largestTradeUsd: number
  }
  tokens: {
    network: string
    mint: string
    symbol: string
    buyUsd: number
    sellUsd: number
    netUsd: number
    trades: number
    lastAt: string
  }[]
  series: { date: string; buyUsd: number; sellUsd: number }[]
  recent: {
    id: string
    network: string
    kind: string
    wallet: string
    mint: string
    symbol: string
    amountUsd: number
    createdAt: string
  }[]
}
