'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jsonFetch } from '@/lib/api-client'
import type { MyPushDTO, PushDeviceDTO } from '@/lib/notify-types'

/**
 * Lado del navegador de los avisos push.
 *
 * El navegador da una "suscripción" (una URL única de su servicio de push más
 * dos claves) que se guarda en Cabal. Esa URL identifica al dispositivo, así
 * que es la que se usa para cambiar sus preferencias o darlo de baja.
 *
 * En iPhone esto solo existe si la app está instalada en la pantalla de
 * inicio (iOS 16.4 o superior); en una pestaña normal de Safari no hay push.
 */

export type PushPrefs = PushDeviceDTO['prefs']

export const DEFAULT_PREFS: PushPrefs = {
  launches: true,
  reminders: true,
  calls: false,
  theses: false,
  replies: true,
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

/** ¿Está la web instalada como app? (iOS solo da push en ese caso) */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/** La clave pública VAPID viaja en base64url y el navegador la pide en bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function keyToBase64(key: ArrayBuffer | null): string {
  if (!key) return ''
  return btoa(String.fromCharCode(...new Uint8Array(key)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Un nombre reconocible para la lista de dispositivos ("Chrome · Android"). */
function deviceLabel(): string {
  const ua = navigator.userAgent
  const browser = /edg/i.test(ua)
    ? 'Edge'
    : /chrome|crios/i.test(ua)
      ? 'Chrome'
      : /firefox|fxios/i.test(ua)
        ? 'Firefox'
        : /safari/i.test(ua)
          ? 'Safari'
          : 'Navegador'
  const os = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'iPhone'
      : /windows/i.test(ua)
        ? 'Windows'
        : /mac/i.test(ua)
          ? 'Mac'
          : 'este dispositivo'
  return `${browser} · ${os}${isStandaloneApp() ? ' (app)' : ''}`
}

export function useMyPush() {
  return useQuery<MyPushDTO>({
    queryKey: ['me', 'push'],
    queryFn: () => jsonFetch('/api/me/push'),
    staleTime: 60_000,
  })
}

/** La suscripción de ESTE navegador, si ya la hay. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/**
 * Pide permiso, suscribe este dispositivo y lo guarda en Cabal.
 * Devuelve el endpoint, o lanza un error con el motivo.
 */
export async function enablePush(publicKey: string, prefs: PushPrefs = DEFAULT_PREFS): Promise<string> {
  if (!pushSupported()) {
    throw new Error(
      isIosDevice() && !isStandaloneApp()
        ? 'En iPhone primero hay que instalar Cabal: Compartir → Añadir a pantalla de inicio'
        : 'Este navegador no admite avisos push'
    )
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Bloqueaste los avisos para Cabal. Actívalos en los ajustes del navegador.'
        : 'No se concedió el permiso de avisos'
    )
  }
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }))

  await jsonFetch('/api/me/push', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: keyToBase64(sub.getKey('p256dh')), auth: keyToBase64(sub.getKey('auth')) },
      label: deviceLabel(),
      prefs,
    }),
  })
  return sub.endpoint
}

/** Da de baja este dispositivo, en el navegador y en Cabal. */
export async function disablePush(endpoint?: string): Promise<void> {
  const sub = await currentSubscription()
  const target = endpoint ?? sub?.endpoint
  if (sub && (!endpoint || sub.endpoint === endpoint)) await sub.unsubscribe().catch(() => null)
  if (target) await jsonFetch('/api/me/push', { method: 'DELETE', body: JSON.stringify({ endpoint: target }) })
}

export function useUpdatePushPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ endpoint, prefs, test }: { endpoint: string; prefs: Partial<PushPrefs>; test?: boolean }) =>
      jsonFetch<{ ok: boolean; device: PushDeviceDTO }>('/api/me/push', {
        method: 'PATCH',
        body: JSON.stringify({ endpoint, prefs, test }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'push'] }),
  })
}
