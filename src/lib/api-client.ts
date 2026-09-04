'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  AdminOverviewDTO,
  AdminUserRowDTO,
  AffiliatePlatformDTO,
  LaunchDetailDTO,
  LaunchDTO,
  LeaderboardDTO,
  MeDTO,
  PostDTO,
  TokenDTO,
  TokenDetailDTO,
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
  x: { configured: boolean; callbackUrl: string }
  google: { configured: boolean; callbackUrl: string }
}

export const qk = {
  me: ['me'] as const,
  authStatus: ['authStatus'] as const,
  launches: ['launches'] as const,
  launch: (id: string) => ['launch', id] as const,
  tokens: (sort?: string, network?: string) => ['tokens', sort, network] as const,
  token: (id: string) => ['token', id] as const,
  feed: ['feed'] as const,
  leaderboard: ['leaderboard'] as const,
  points: ['points'] as const,
  adminOverview: ['admin', 'overview'] as const,
  adminUsers: ['admin', 'users'] as const,
  adminRules: ['admin', 'rules'] as const,
  adminLaunches: ['admin', 'launches'] as const,
  adminTokens: ['admin', 'tokens'] as const,
  affiliates: ['affiliates'] as const,
  adminAffiliates: ['admin', 'affiliates'] as const,
}

export function useMe() {
  return useQuery<MeDTO>({ queryKey: qk.me, queryFn: () => jsonFetch('/api/me') })
}

/** Estado de configuración OAuth (API keys reales) de X y Google. */
export function useAuthStatus() {
  return useQuery<AuthStatusDTO>({
    queryKey: qk.authStatus,
    queryFn: () => jsonFetch('/api/auth/status'),
    staleTime: 60_000,
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

export function useAdminAffiliates(enabled: boolean) {
  return useQuery<AffiliatePlatformDTO[]>({
    queryKey: qk.adminAffiliates,
    queryFn: () => jsonFetch('/api/admin/affiliate'),
    enabled,
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
    mutationFn: (data: { kind: string; content: string; launchId?: string; tokenId?: string }) =>
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

export function useUpdateMe() {
  const invalidate = useInvalidateOnSuccess()
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
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
    mutationFn: (data: { name: string; url?: string }) =>
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
