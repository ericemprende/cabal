/**
 * Arranque del servidor de Next. Aquí vive el worker de avisos (Telegram,
 * Discord y campanita de launches): ver lib/notify-worker.ts. NOTIFY_WORKER=off
 * lo apaga (p. ej. si algún día se ejecuta como proceso aparte).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  // Métricas del servidor (panel de admin → Salud del servidor)
  const { startMetricsCollector } = await import('@/lib/metrics-collector')
  startMetricsCollector()
  if (process.env.NOTIFY_WORKER === 'off') return
  const { startNotifyWorker } = await import('@/lib/notify-worker')
  startNotifyWorker()
}
