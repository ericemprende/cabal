'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { PUSH_KIND_LABELS } from '@/lib/notify-types'
import {
  DEFAULT_PREFS,
  currentSubscription,
  disablePush,
  enablePush,
  isIosDevice,
  isStandaloneApp,
  pushSupported,
  useMyPush,
  useUpdatePushPrefs,
} from '@/lib/push-client'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Avisos push: encender los de este dispositivo y elegir cuáles llegan.
 *
 * Las preferencias son POR DISPOSITIVO a propósito: lo normal es querer los
 * avisos en el teléfono y no en el ordenador del trabajo. Los otros
 * dispositivos se listan abajo y se pueden desconectar desde aquí.
 */
export function PushSettings() {
  const { data, isPending } = useMyPush()
  const update = useUpdatePushPrefs()
  const qc = useQueryClient()
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Qué suscripción tiene ESTE navegador ahora mismo
  useEffect(() => {
    let alive = true
    currentSubscription().then((s) => alive && setEndpoint(s?.endpoint ?? null))
    return () => {
      alive = false
    }
  }, [data?.devices.length])

  if (!isPending && data && !data.configured) return null

  const supported = pushSupported()
  const iosNeedsInstall = isIosDevice() && !isStandaloneApp()
  const thisDevice = endpoint ? data?.devices.find((d) => d.endpoint === endpoint) : undefined
  const others = (data?.devices ?? []).filter((d) => d.endpoint !== endpoint)
  const on = Boolean(thisDevice)

  const toggleDevice = async (value: boolean) => {
    setBusy(true)
    try {
      if (value) {
        const ep = await enablePush(data?.publicKey ?? '', DEFAULT_PREFS)
        setEndpoint(ep)
        toast.success('Avisos activados en este dispositivo')
      } else {
        await disablePush(endpoint ?? undefined)
        setEndpoint(null)
        toast('Avisos desactivados aquí')
      }
      await qc.invalidateQueries({ queryKey: ['me', 'push'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const removeOther = async (ep: string) => {
    await disablePush(ep).catch(() => null)
    await qc.invalidateQueries({ queryKey: ['me', 'push'] })
  }

  return (
    <div className="border-b border-white/10 p-4">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          {on ? <Bell className="h-4 w-4 text-primary" aria-hidden /> : <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Avisos en este dispositivo</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {iosNeedsInstall
              ? 'En iPhone hay que instalar Cabal primero: Compartir → Añadir a pantalla de inicio'
              : !supported
                ? 'Este navegador no admite avisos push'
                : on
                  ? 'Llegan aunque no tengas Cabal abierto'
                  : 'Enciéndelos para enterarte sin tener Cabal abierto'}
          </p>
        </div>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Switch
            checked={on}
            disabled={!supported || iosNeedsInstall || isPending}
            onCheckedChange={toggleDevice}
            aria-label="Avisos push en este dispositivo"
          />
        )}
      </div>

      {/* Qué avisos llegan a este dispositivo */}
      {on && thisDevice && (
        <div className="mt-2 space-y-1">
          {PUSH_KIND_LABELS.map(({ key, title, hint }) => (
            <label
              key={key}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5',
                update.isPending && 'opacity-70'
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold">{title}</p>
                <p className="text-[10.5px] leading-snug text-muted-foreground">{hint}</p>
              </div>
              <Switch
                checked={thisDevice.prefs[key]}
                onCheckedChange={(v) =>
                  update.mutate(
                    // Al encender el primero se manda un aviso de prueba
                    { endpoint: thisDevice.endpoint, prefs: { [key]: v }, test: v && !Object.values(thisDevice.prefs).some(Boolean) },
                    { onError: (e) => toast.error((e as Error).message) }
                  )
                }
                aria-label={title}
              />
            </label>
          ))}
        </div>
      )}

      {/* Otros dispositivos de la cuenta */}
      {others.length > 0 && (
        <div className="mt-2.5">
          <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Otros dispositivos
          </p>
          {others.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <p className="min-w-0 flex-1 truncate text-[12px]">{d.label ?? 'Dispositivo'}</p>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {Object.values(d.prefs).filter(Boolean).length} avisos
              </span>
              <button
                onClick={() => removeOther(d.endpoint)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-[#ff8080]"
                aria-label={`Quitar ${d.label ?? 'dispositivo'}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
