import { runNotificationTick } from '@/lib/notifications'
import { syncDiscordGateway } from '@/lib/discord-gateway'
import { redis } from '@/lib/redis'
import { syncPremiumVerifications } from '@/lib/verification'

/**
 * Worker de avisos dentro del propio servidor de Next (lo arranca
 * instrumentation.ts). En producción la app es un único contenedor sin
 * procesos aparte, así que un setInterval aquí es lo más simple que funciona.
 *
 * Si algún día hay varias réplicas, el cerrojo de Redis evita que todas hagan
 * la pasada a la vez; aun sin Redis no se duplica nada, porque cada envío se
 * reserva en NotificationDispatch.
 */

const g = globalThis as unknown as { __cabalNotifyWorker?: boolean }

export function startNotifyWorker() {
  if (g.__cabalNotifyWorker) return
  g.__cabalNotifyWorker = true
  const intervalMs = Math.max(15, Number(process.env.NOTIFY_INTERVAL ?? 30)) * 1000
  let running = false

  const tick = async () => {
    if (running) return
    running = true
    try {
      if (redis) {
        const got = await redis.set('cabal:notify:lock', '1', 'EX', Math.ceil(intervalMs / 1000), 'NX').catch(() => 'OK')
        if (got !== 'OK') return
      }
      // Arranca o para la conexión con Discord según esté el bot: así conectarlo
      // desde el panel la levanta sola, sin reiniciar el servidor.
      await syncDiscordGateway().catch((e) => console.error('[discord-gateway]', (e as Error).message))
      // Verificaciones Premium: se apagan si el dueño dejó de pagar y vuelven si renueva
      await syncPremiumVerifications().catch((e) => console.error('[verify]', (e as Error).message))
      const r = await runNotificationTick()
      if (r.messages || r.emails || r.push) {
        console.log(
          `[notify] launches ${r.launches} · tesis ${r.theses} · recordatorios ${r.reminders} → ${r.messages} mensaje(s), ${r.emails} correo(s), ${r.push} push`
        )
      }
    } catch (e) {
      console.error('[notify] pasada fallida:', (e as Error).message)
    } finally {
      running = false
    }
  }

  // Primer intento con margen: deja que el servidor termine de arrancar
  setTimeout(tick, 20_000)
  setInterval(tick, intervalMs)
  console.log(`[notify] worker de avisos activo (cada ${intervalMs / 1000}s)`)
}
