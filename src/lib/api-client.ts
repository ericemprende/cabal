'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import bs58 from 'bs58'
import { toast } from 'sonner'
import type {
  AdminOverviewDTO,
  AdminPremiumDTO,
  AdminUserRowDTO,
  AdminWaitlistDTO,
  AffiliatePlatformDTO,
  BuildBuyDTO,
  BuildSellDTO,
  ChatMessageDTO,
  DevClaimDTO,
  LaunchDetailDTO,
  LaunchDTO,
  LeaderboardDTO,
  MeDTO,
  PostDTO,
  PremiumInfoDTO,
  ProjectClaimDTO,
  PublicProfileDTO,
  PublicUserDTO,
  ReferralDTO,
  SwapConfigDTO,
  SwapFeeConfigDTO,
  TokenBalanceDTO,
  TokenDTO,
  TokenDetailDTO,
  UserDTO,
} from '@/lib/types'

export async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export type AuthStatusDTO = {
  /** demo: sin credenciales se puede usar el flujo simulado (solo en desarrollo). */
  x: { configured: boolean; demo: boolean; callbackUrl: string }
  google: { configured: boolean; demo: boolean; callbackUrl: string }
}

export type SessionDTO = {
  loggedIn: boolean
  user?: UserDTO
}

// ---------- Proveedores de wallet del navegador ----------
type PhantomProvider = {
  connect?: () => Promise<{ publicKey: { toString(): string } }>
  signMessage?: (msg: Uint8Array, enc: 'utf8') => Promise<{ signature: Uint8Array }>
}

type EvmProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider }
    solana?: PhantomProvider
    ethereum?: EvmProvider
  }
}

/** ¿Hay wallet del navegador disponible para esta red? */
export function injectedWalletFor(network: string): 'phantom' | 'evm' | null {
  if (typeof window === 'undefined') return null
  const solana = ['solana'].includes(network)
  if (solana && (window.phantom?.solana || window.solana)) return 'phantom'
  if (['ethereum', 'base', 'bsc', 'robinhood'].includes(network) && window.ethereum) return 'evm'
  return null
}

/**
 * Pide la firma del mensaje de verificación con la wallet del navegador:
 * - Solana: phantom.solana.signMessage → base58 (verificada con tweetnacl).
 * - EVM: personal_sign → verificada con ecrecover (ethers) en el backend.
 */
export async function requestWalletSignature(
  network: string,
  address: string,
  message: string
): Promise<string> {
  if (network === 'solana') {
    const provider = window.phantom?.solana ?? window.solana
    if (!provider?.signMessage) throw new Error('No se detectó Phantom. Instala la extensión o pega la dirección.')
    const encoded = new TextEncoder().encode(message)
    const res = await provider.signMessage(encoded, 'utf8')
    return bs58.encode(res.signature)
  }
  const ethereum = window.ethereum
  if (!ethereum) throw new Error('No se detectó MetaMask. Instala la extensión o pega la dirección.')
  await ethereum.request({ method: 'eth_requestAccounts' })
  const hexMessage =
    '0x' +
    Array.from(new TextEncoder().encode(message))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  const sig = await ethereum.request({ method: 'personal_sign', params: [hexMessage, address] })
  return String(sig)
}

export const qk = {
  me: ['me'] as const,
  session: ['session'] as const,
  authStatus: ['authStatus'] as const,
  launches: ['launches'] as const,
  launch: (id: string) => ['launch', id] as const,
  tokens: (sort?: string, network?: string) => ['tokens', sort, network] as const,
  token: (id: string) => ['token', id] as const,
  feed: ['feed'] as const,
  leaderboard: ['leaderboard'] as const,
  points: ['points'] as const,
  chatMessages: ['chat', 'messages'] as const,
  adminOverview: ['admin', 'overview'] as const,
  adminUsers: ['admin', 'users'] as const,
  adminRules: ['admin', 'rules'] as const,
  adminLaunches: ['admin', 'launches'] as const,
  adminTokens: ['admin', 'tokens'] as const,
  adminPosts: ['admin', 'posts'] as const,
  affiliates: ['affiliates'] as const,
  adminAffiliates: ['admin', 'affiliates'] as const,
  adminSwapFees: ['admin', 'swap-fees'] as const,
  adminWaitlist: ['admin', 'waitlist'] as const,
  waitlistMe: ['waitlist', 'me'] as const,
  referral: ['me', 'referral'] as const,
  projectClaims: ['me', 'project-claims'] as const,
  user: (handle: string) => ['user', handle.toLowerCase()] as const,
  userFollows: (handle: string, type: 'followers' | 'following') =>
    ['user', handle.toLowerCase(), type] as const,
  premium: ['premium'] as const,
  adminPremium: ['admin', 'premium'] as const,
}

export function useMe() {
  return useQuery<MeDTO>({ queryKey: qk.me, queryFn: () => jsonFetch('/api/me') })
}

/** Código de invitación + estadísticas de referidos. */
export function useReferral() {
  return useQuery<ReferralDTO>({ queryKey: qk.referral, queryFn: () => jsonFetch('/api/me/referral') })
}

export type AffiliatesDTO = {
  code: string
  percent: number
  totalEarned: number
  affiliates: {
    id: string
    handle: string
    name: string
    avatar: string
    xHandle: string | null
    points: number
    earnedForMe: number
    joinedAt: string
  }[]
}

/** Mis afiliados (quienes se registraron con mi enlace). */
export function useMyAffiliates(enabled: boolean) {
  return useQuery<AffiliatesDTO>({
    queryKey: ['my-affiliates'],
    queryFn: () => jsonFetch('/api/me/affiliates'),
    enabled,
  })
}

/** Mis reclamos de propiedad de proyectos. */
export function useProjectClaims() {
  return useQuery<{ claims: ProjectClaimDTO[] }>({
    queryKey: qk.projectClaims,
    queryFn: () => jsonFetch('/api/claims'),
  })
}

/** Reclamar un proyecto por su CA (verificación on-chain en Solana; resto → revisión). */
export function useClaimProject() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: { contract: string; network: string; wallet: string }) =>
      jsonFetch<{ ok: boolean; verified: boolean; note: string; claim: ProjectClaimDTO }>('/api/claims', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (res) => {
      invalidate()
      if (res.verified) {
        toast.success('¡Proyecto verificado como tuyo!', { description: res.note })
      } else {
        toast.warning('Reclamo enviado a revisión', { description: res.note })
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

/** Sesión de usuario: ¿hay cuenta logueada o modo invitado? */
export function useSession() {
  return useQuery<SessionDTO>({
    queryKey: qk.session,
    queryFn: () => jsonFetch('/api/auth/session'),
    staleTime: 30_000,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { handle: string; password: string }) =>
      jsonFetch<{ ok: boolean; user: UserDTO }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries()
      toast.success('Sesión iniciada')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { handle: string; name?: string; email: string; password: string; referralCode?: string }) =>
      jsonFetch<{ ok: boolean; user: UserDTO }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries()
      toast.success('Cuenta creada · bienvenida al Cabal')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => jsonFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries()
      toast.success('Sesión cerrada')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

/** Estado de configuración OAuth (API keys reales) de X y Google. */
export function useAuthStatus() {
  return useQuery<AuthStatusDTO>({
    queryKey: qk.authStatus,
    queryFn: () => jsonFetch('/api/auth/status'),
    staleTime: 60_000,
  })
}

/**
 * Login/registro social en modo demo (sin API keys): crea la sesión con la
 * identidad social vía /api/auth/social. Con keys reales el flujo es por
 * redirección a /api/auth/{provider}/start?mode=login.
 */
export function useSocialLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { provider: 'x' | 'google'; value: string; name?: string }) =>
      jsonFetch<{ ok: boolean; created: boolean }>('/api/auth/social', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries()
      toast.success(
        res.created ? 'Cuenta creada · bienvenida al Cabal' : 'Sesión iniciada',
        { description: 'Identidad verificada · +5 puntos Cabal' }
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useLaunches() {
  return useQuery<LaunchDTO[]>({ queryKey: qk.launches, queryFn: () => jsonFetch('/api/launches') })
}

export function useLaunch(id: string | null) {
  return useQuery<LaunchDetailDTO>({
    queryKey: qk.launch(id ?? ''),
    queryFn: () => jsonFetch(`/api/launches/${id}`),
    enabled: !!id,
  })
}

export function useTokens(sort: string, network: string) {
  return useQuery<TokenDTO[]>({
    queryKey: qk.tokens(sort, network),
    queryFn: () => jsonFetch(`/api/tokens?sort=${sort}&network=${network}`),
  })
}

export function useToken(id: string | null) {
  return useQuery<TokenDetailDTO>({
    queryKey: qk.token(id ?? ''),
    queryFn: () => jsonFetch(`/api/tokens/${id}`),
    enabled: !!id,
  })
}

export function useFeed() {
  return useQuery<PostDTO[]>({ queryKey: qk.feed, queryFn: () => jsonFetch('/api/feed') })
}

export function useLeaderboard() {
  return useQuery<LeaderboardDTO>({
    queryKey: qk.leaderboard,
    queryFn: () => jsonFetch('/api/leaderboard'),
  })
}

export function useAdminOverview(enabled: boolean) {
  return useQuery<AdminOverviewDTO>({
    queryKey: qk.adminOverview,
    queryFn: () => jsonFetch('/api/admin/overview'),
    enabled,
  })
}

export function useAdminUsers(enabled: boolean) {
  return useQuery<AdminUserRowDTO[]>({
    queryKey: qk.adminUsers,
    queryFn: () => jsonFetch('/api/admin/users'),
    enabled,
  })
}

export function useAdminPremium(enabled: boolean) {
  return useQuery<AdminPremiumDTO>({
    queryKey: qk.adminPremium,
    queryFn: () => jsonFetch('/api/admin/premium'),
    enabled,
  })
}

export function useAdminGrantPremium() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: { handle: string; days: number | null; note?: string }) =>
      jsonFetch<{ ok: boolean }>('/api/admin/premium/grant', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Premium regalado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminRevokePremium() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (id: string) => jsonFetch<{ ok: boolean }>(`/api/admin/premium/grant?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('Acceso retirado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export type AdminCallRowDTO = {
  id: string
  content: string
  contract: string | null
  network: string | null
  createdAt: string
  user: { id: string; name: string; handle: string; avatar: string }
  symbol: string
  pctChange: number | null
  found: boolean
}

export type AdminCallLeaderRowDTO = {
  user: { id: string; name: string; handle: string; avatar: string }
  total: number
  withData: number
  winRate: number | null
  avgPct: number | null
}

/** Calls por usuario (últimas 300), con %s en vivo desde que se publicaron. */
export function useAdminCalls(enabled: boolean) {
  return useQuery<{ calls: AdminCallRowDTO[]; leaderboard: AdminCallLeaderRowDTO[] }>({
    queryKey: ['admin-calls'],
    queryFn: () => jsonFetch('/api/admin/calls'),
    enabled,
  })
}

export function useAdminLaunches(enabled: boolean) {
  return useQuery<LaunchDTO[]>({
    queryKey: qk.adminLaunches,
    queryFn: () => jsonFetch('/api/admin/launches'),
    enabled,
  })
}

export function useAdminTokens(enabled: boolean) {
  return useQuery<TokenDTO[]>({
    queryKey: qk.adminTokens,
    queryFn: () => jsonFetch('/api/admin/tokens'),
    enabled,
  })
}

/** Plataformas afiliadas activas (enlaces madre de referido para "Comprar"). */
export function useAffiliates() {
  return useQuery<AffiliatePlatformDTO[]>({
    queryKey: qk.affiliates,
    queryFn: () => jsonFetch('/api/affiliate'),
    staleTime: 5 * 60_000,
  })
}

/** Config para comprar sin salir de Cabal (Solana, vía la API de Jupiter). */
export function useSwapConfig() {
  return useQuery<SwapConfigDTO>({
    queryKey: ['swap', 'config'],
    queryFn: () => jsonFetch('/api/swap/config'),
    staleTime: 5 * 60_000,
  })
}

/** Cotiza y arma la(s) transacción(es) de una compra. No firma ni manda nada. */
export function useBuildBuy() {
  return useMutation({
    mutationFn: (data: { outputMint: string; amountUsd: number; userPublicKey: string }) =>
      jsonFetch<BuildBuyDTO>('/api/swap/build', { method: 'POST', body: JSON.stringify(data) }),
  })
}

/** Cotiza y arma la(s) transacción(es) de una venta (porcentaje del saldo). No firma ni manda nada. */
export function useBuildSell() {
  return useMutation({
    mutationFn: (data: { inputMint: string; percent: number; userPublicKey: string }) =>
      jsonFetch<BuildSellDTO>('/api/swap/sell', { method: 'POST', body: JSON.stringify(data) }),
  })
}

/**
 * Avisa que una compra/venta ya se firmó y mandó a la red, para que — si de
 * verdad corrió on-chain — el invitador de quien operó gane puntos por la
 * comisión generada. Se llama después de signAndSendTransaction; nunca
 * bloquea ni afecta el resultado de la compra/venta en sí.
 */
export function useConfirmSwap() {
  return useMutation({
    mutationFn: (data: { intentId: string; signature: string }) =>
      jsonFetch<{ ok: boolean; pointsAwarded: number }>('/api/swap/confirm', { method: 'POST', body: JSON.stringify(data) }),
  })
}

/** Saldo de un token (o SOL) de una wallet, para las opciones "25%/50%/100%" al vender. */
export function useTokenBalance(owner: string | null, mint: string | null) {
  return useQuery<TokenBalanceDTO>({
    queryKey: ['swap', 'balance', owner, mint],
    queryFn: () => jsonFetch(`/api/swap/balance?owner=${owner}&mint=${mint}`),
    enabled: !!owner && !!mint,
    staleTime: 10_000,
  })
}

export function useAdminAffiliates(enabled: boolean) {
  return useQuery<AffiliatePlatformDTO[]>({
    queryKey: qk.adminAffiliates,
    queryFn: () => jsonFetch('/api/admin/affiliate'),
    enabled,
  })
}

/** Comisión de swap por red (una fila por red, aunque todavía no tenga swap propio). */
export function useAdminSwapFees(enabled: boolean) {
  return useQuery<SwapFeeConfigDTO[]>({
    queryKey: qk.adminSwapFees,
    queryFn: () => jsonFetch('/api/admin/swap-fees'),
    enabled,
  })
}

export function useAdminSaveSwapFee(enabled: boolean) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<SwapFeeConfigDTO, 'network'> & { network: string }) =>
      jsonFetch<{ ok: boolean; config: SwapFeeConfigDTO }>('/api/admin/swap-fees', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      if (enabled) qc.invalidateQueries({ queryKey: qk.adminSwapFees })
      toast.success('Comisión guardada')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ---------- upload ----------
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !body.url) throw new Error(body.error ?? 'No se pudo subir la imagen')
  return body.url
}

// ---------- mutations ----------
function useInvalidateOnSuccess() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

export function useHypeToggle() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (launchId: string) =>
      jsonFetch<{ ok: boolean; hyped: boolean; hype: number }>(`/api/launches/${launchId}/hype`, {
        method: 'POST',
      }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message || 'No se pudo dar hype'),
  })
}

export function useLikeToggle() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (postId: string) =>
      jsonFetch<{ ok: boolean; liked: boolean; likes: number }>(`/api/posts/${postId}/like`, {
        method: 'POST',
      }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message || 'No se pudo dar like'),
  })
}

export type CallResultDTO = {
  found: boolean
  entryPriceUsd: number | null
  currentPriceUsd: number | null
  entryMc: number | null
  currentMc: number | null
  peakMc: number | null
  peakAt: number | null
  symbol: string
  image: string
  pctChange: number | null
  multiple: number | null
  peakMultiple: number | null
  pairUrl: string
  calledAt: string
}

/** Resultado en vivo de una call: público, no requiere sesión. */
export function useCallResult(postId: string, enabled: boolean) {
  return useQuery<CallResultDTO>({
    queryKey: ['call-result', postId],
    queryFn: () => jsonFetch(`/api/posts/${postId}/result`),
    enabled,
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}

export function useFollowToggle() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (userId: string) =>
      jsonFetch<{ ok: boolean; following: boolean }>(`/api/follow/${userId}`, { method: 'POST' }),
    onSuccess: () => invalidate(),
  })
}

export function useCreatePost() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: {
      kind: string
      content: string
      launchId?: string
      tokenId?: string
      contract?: string
      network?: string
    }) =>
      jsonFetch<{ ok: boolean; pointsEarned: number }>('/api/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (res, vars) => {
      invalidate()
      if (res.pointsEarned > 0) {
        toast.success(`+${res.pointsEarned} puntos Cabal`, {
          description: vars.kind === 'thesis' ? 'Publicaste una tesis' : 'Publicaste un comentario',
        })
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useCreateLaunch() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      jsonFetch<{ ok: boolean; pointsEarned: number }>('/api/launches', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (res) => {
      invalidate()
      if (res.pointsEarned > 0)
        toast.success(`+${res.pointsEarned} puntos Cabal`, {
          description: 'Launch publicado en el Radar',
        })
      else toast.success('Launch publicado en el Radar')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

/**
 * Editar un launch. Solo lo acepta el servidor si quien lo pide lo publicó o es
 * admin (ver PATCH /api/launches/[id]). Los avisos los pone quien la usa.
 */
export function useUpdateLaunch(id: string) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      jsonFetch<{ ok: boolean }>(`/api/launches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateMe() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: Record<string, string | boolean>) =>
      jsonFetch<{ ok: boolean }>('/api/me', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidate()
      toast.success('Perfil actualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useVerifyProvider() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: { provider: 'x' | 'google'; value?: string; disconnect?: boolean }) =>
      jsonFetch<{ ok: boolean; pointsEarned: number }>('/api/me/verify', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (res, vars) => {
      invalidate()
      if (vars.disconnect) {
        toast.success('Conexión eliminada')
      } else {
        toast.success(
          res.pointsEarned > 0 ? `Verificado · +${res.pointsEarned} puntos Cabal` : 'Cuenta verificada',
          { description: vars.provider === 'x' ? 'Cuenta de X conectada' : 'Cuenta de Google conectada' }
        )
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ---------- Wallets y verificación de dev ----------

export function useAddWallet() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: { network: string; address: string; label?: string }) =>
      jsonFetch<{ id: string }>('/api/me/wallets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Wallet conectada', { description: 'Fírmala para verificar que eres el dueño' })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

/** Firma la posesión de la wallet con el proveedor del navegador y la verifica en el backend. */
export function useVerifyWalletSignature() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: async (data: { id: string; network: string; address: string }) => {
      const message = `Cabal: verifico que soy el dueño de la wallet ${data.address}\nFirmar este mensaje es seguro y no da acceso a tus fondos.`
      const signature = await requestWalletSignature(data.network, data.address, message)
      return jsonFetch<{ ok: boolean; pointsEarned: number }>('/api/me/wallets/verify', {
        method: 'POST',
        body: JSON.stringify({ id: data.id, message, signature }),
      })
    },
    onSuccess: (res) => {
      invalidate()
      toast.success(
        res.pointsEarned > 0 ? `Wallet verificada · +${res.pointsEarned} puntos Cabal` : 'Wallet verificada',
        { description: 'Firma comprobada criptográficamente' }
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useRemoveWallet() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: boolean }>(`/api/me/wallets?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('Wallet desconectada')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useVerifyDevToken() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: { network: string; contract: string; walletAddress: string }) =>
      jsonFetch<{ ok: boolean; verified: boolean; claim: DevClaimDTO }>('/api/me/claims', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (res) => {
      invalidate()
      if (res.verified) {
        toast.success('Token verificado on-chain', {
          description: 'Tus métricas como dev ya aparecen en tu perfil',
        })
      } else {
        toast.warning('Token guardado como pendiente', {
          description: 'No encontramos un par activo para ese CA; reinténtalo más tarde.',
        })
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useRemoveDevToken() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: boolean }>(`/api/me/claims?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('Token eliminado del track record')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminAdjustPoints(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: { userId: string; amount: number; note?: string }) =>
      jsonFetch<{ ok: boolean; points: number }>('/api/admin/points', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminRules(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (rules: Record<string, number>) =>
      jsonFetch<{ ok: boolean }>('/api/admin/rules', {
        method: 'PUT',
        body: JSON.stringify(rules),
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Reglas de puntos actualizadas')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminUpdateUser(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: Record<string, unknown> & { id: string }) =>
      jsonFetch<{ ok: boolean }>('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Perfil actualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminUpdateLaunch(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: Record<string, unknown> & { id: string }) =>
      jsonFetch<{ ok: boolean }>('/api/admin/launches', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Launch actualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminDeleteLaunch(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (launchId: string) =>
      jsonFetch<{ ok: boolean }>(`/api/admin/launches?id=${encodeURIComponent(launchId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Launch eliminado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export type AdminPostDTO = {
  id: string
  kind: string
  content: string
  likes: number
  createdAt: string
  user: { id: string; name: string; handle: string; avatar: string }
  launchName: string | null
  tokenName: string | null
}

export function useAdminPosts(enabled: boolean, kind?: 'thesis' | 'comment') {
  return useQuery<{ posts: AdminPostDTO[] }>({
    queryKey: [...qk.adminPosts, kind ?? 'all'],
    queryFn: () => jsonFetch(`/api/admin/posts${kind ? `?kind=${kind}` : ''}`),
    enabled,
  })
}

export function useAdminDeletePost(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (postId: string) =>
      jsonFetch<{ ok: boolean }>(`/api/admin/posts?id=${encodeURIComponent(postId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Eliminado del feed')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminUpdateToken(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: Record<string, unknown> & { id: string }) =>
      jsonFetch<{ ok: boolean }>('/api/admin/tokens', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Token actualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminSaveAffiliate(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: Record<string, unknown> & { id: string }) =>
      jsonFetch<{ ok: boolean }>('/api/admin/affiliate', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Plataforma afiliada guardada')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminCreateAffiliate(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: { name: string; url?: string; links?: Record<string, string> }) =>
      jsonFetch<{ ok: boolean; id: string }>('/api/admin/affiliate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Plataforma añadida')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminDeleteAffiliate(enabled: boolean) {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: boolean }>(`/api/admin/affiliate?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Plataforma eliminada')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ---------- Lista de espera (whitelist) ----------
export function useAdminWaitlist(enabled: boolean, filters?: { status?: string; q?: string; all?: boolean }) {
  const params = new URLSearchParams()
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters?.q) params.set('q', filters.q)
  if (filters?.all) params.set('all', '1')
  const qs = params.toString()
  return useQuery<AdminWaitlistDTO>({
    queryKey: [...qk.adminWaitlist, qs],
    queryFn: () => jsonFetch(`/api/admin/waitlist${qs ? `?${qs}` : ''}`),
    enabled,
  })
}

export function useAdminUpdateWaitlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id?: string; ids?: string[]; status?: string; note?: string }) =>
      jsonFetch<{ ok: boolean; updated: number }>('/api/admin/waitlist', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminWaitlist })
      toast.success('Lista de espera actualizada')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useAdminDeleteWaitlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: boolean }>(`/api/admin/waitlist?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminWaitlist })
      toast.success('Entrada eliminada')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ---------- Perfil público ----------

/** Perfil público de un usuario (/u/<handle>). */
export function useUserProfile(handle: string) {
  return useQuery<PublicProfileDTO>({
    queryKey: qk.user(handle),
    queryFn: () => jsonFetch(`/api/users/${encodeURIComponent(handle)}`),
    enabled: Boolean(handle),
  })
}

/** Seguidores o seguidos de un usuario. Solo se pide al abrir la lista. */
export function useUserFollows(handle: string, type: 'followers' | 'following', enabled: boolean) {
  return useQuery<{ users: PublicUserDTO[] }>({
    queryKey: qk.userFollows(handle, type),
    queryFn: () => jsonFetch(`/api/users/${encodeURIComponent(handle)}/follows?type=${type}`),
    enabled: enabled && Boolean(handle),
  })
}

// ---------- Premium ----------

/** Planes a la venta, pasarelas disponibles y el estado premium de quien pregunta. */
export function usePremiumInfo(enabled = true) {
  return useQuery<PremiumInfoDTO>({
    queryKey: qk.premium,
    queryFn: () => jsonFetch('/api/premium'),
    enabled,
  })
}

/**
 * Abre una pestaña en blanco ya mismo (dentro del gesto de clic, si no los
 * navegadores bloquean el popup) y la navega en cuanto llegue la URL real.
 * Así la pasarela se abre en pestaña nueva en vez de dejar Cabal atrás.
 * Si el navegador bloqueó el popup, cae de vuelta a navegar la misma pestaña.
 */
function navigateInNewTab(url: string, popup: Window | null) {
  if (popup && !popup.closed) {
    popup.location.href = url
  } else {
    window.location.assign(url)
  }
}

/**
 * Arranca el pago de un plan y redirige a la pasarela (Stripe Checkout o la
 * factura de NOWPayments). El acceso se activa solo cuando el proveedor
 * confirma el pago; aquí solo se abre la página para pagar.
 *
 * Quien llama debe abrir la pestaña con `window.open('', '_blank')` en el
 * propio manejador del clic y pasarla como `popup` en `mutate` — abrirla acá
 * dentro de onSuccess llega tarde (ya hubo un fetch de por medio) y el
 * navegador bloquea el popup.
 */
export function useStartPremiumCheckout() {
  return useMutation({
    mutationFn: (data: { plan: string; method: 'card' | 'crypto'; popup?: Window | null }) =>
      jsonFetch<{ url: string }>('/api/premium/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan: data.plan, method: data.method }),
      }),
    onSuccess: (res, variables) => {
      navigateInNewTab(res.url, variables.popup ?? null)
    },
    onError: (_e: Error, variables) => {
      variables.popup?.close()
      toast.error(_e.message)
    },
  })
}

/** Portal de facturación de Stripe: cambiar tarjeta, cancelar, descargar facturas. */
export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: (_popup?: Window | null) => jsonFetch<{ url: string }>('/api/premium/portal', { method: 'POST' }),
    onSuccess: (res, popup) => {
      navigateInNewTab(res.url, popup ?? null)
    },
    onError: (e: Error, popup) => {
      popup?.close()
      toast.error(e.message)
    },
  })
}

/** Confirma el pago al volver de Stripe Checkout (?session_id=...), sin esperar al webhook. */
export function useConfirmPremiumCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      jsonFetch<{ status: unknown }>('/api/premium/confirm', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me })
      qc.invalidateQueries({ queryKey: qk.premium })
    },
  })
}

// ---------- Chat en vivo ----------
/** Historial de los últimos mensajes del chat global (los nuevos llegan por Pusher, ver live-chat.tsx). */
export function useChatMessages() {
  return useQuery<ChatMessageDTO[]>({ queryKey: qk.chatMessages, queryFn: () => jsonFetch('/api/chat/messages') })
}

export function useSendChatMessage() {
  return useMutation({
    mutationFn: (body: string) =>
      jsonFetch<ChatMessageDTO>('/api/chat/messages', { method: 'POST', body: JSON.stringify({ body }) }),
  })
}
