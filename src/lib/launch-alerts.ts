import { db } from '@/lib/db'
import { launchAlertEmail, sendEmail } from '@/lib/email'
import { premiumUserIdsAmong } from '@/lib/premium'
import { siteUrl } from '@/lib/waitlist'

/**
 * Aviso Premium: "tu launch está por salir", por correo. Umbrales en minutos
 * antes del lanzamiento; añadir uno nuevo es sumarlo aquí.
 *
 * Quién lo recibe: quien le dio hype al launch o sigue a quien lo publicó —
 * no todos los suscriptores Premium por cada launch, que sería spam. Sin
 * correo verificado, sin Premium, o con notifyEmail desactivado, no llega.
 *
 * Corre desde scripts/launch-alerts.mjs (bun run alerts:watch), sondeando
 * cada POLL_INTERVAL_S. Cada umbral se reserva en LaunchAlert ANTES de
 * mandar los correos: si el sondeo se solapa o se relanza, nunca se avisa
 * dos veces del mismo umbral.
 */

export const ALERT_THRESHOLDS_MIN = [10, 5] as const
/** Ancho de la ventana en la que se considera "se cruzó el umbral" (± mitad). */
const WINDOW_MS = 90_000

export async function sendDueLaunchAlerts(): Promise<{ checked: number; sent: number }> {
  const now = Date.now()
  let checked = 0
  let sent = 0

  for (const minutes of ALERT_THRESHOLDS_MIN) {
    const target = now + minutes * 60_000
    const launches = await db.launch.findMany({
      where: {
        hidden: false,
        launchAt: { gte: new Date(target - WINDOW_MS / 2), lt: new Date(target + WINDOW_MS / 2) },
      },
      select: { id: true, name: true, ticker: true, createdById: true },
    })
    checked += launches.length

    for (const launch of launches) {
      // Reserva atómica del umbral: si otra pasada ya lo tomó, P2002 y se salta.
      try {
        await db.launchAlert.create({ data: { launchId: launch.id, threshold: minutes } })
      } catch (e) {
        if ((e as { code?: string }).code === 'P2002') continue
        throw e
      }

      const n = await notifyLaunch(launch, minutes)
      sent += n
    }
  }
  return { checked, sent }
}

async function notifyLaunch(
  launch: { id: string; name: string; ticker: string | null; createdById: string },
  minutes: number
): Promise<number> {
  const [hypers, followers] = await Promise.all([
    db.vote.findMany({ where: { target: 'launch', targetId: launch.id }, select: { userId: true } }),
    db.follow.findMany({ where: { targetId: launch.createdById }, select: { userId: true } }),
  ])
  const candidateIds = [...new Set([...hypers.map((v) => v.userId), ...followers.map((f) => f.userId)])]
  if (candidateIds.length === 0) return 0

  const [premiumIds, users] = await Promise.all([
    premiumUserIdsAmong(candidateIds),
    db.user.findMany({
      where: { id: { in: candidateIds }, emailVerified: true, notifyEmail: true, email: { not: null } },
      select: { id: true, email: true },
    }),
  ])
  const recipients = users.filter((u) => premiumIds.has(u.id))
  if (recipients.length === 0) return 0

  const { subject, html, text } = launchAlertEmail(launch, minutes, `${siteUrl()}/app`)
  let ok = 0
  // En serie: son pocos destinatarios por launch y así un fallo de uno no
  // frena el envío a los demás sin necesitar Promise.allSettled.
  for (const u of recipients) {
    try {
      await sendEmail({ to: u.email!, subject, html, text })
      ok++
    } catch (e) {
      console.error(`[launch-alerts] no se pudo avisar a ${u.id} de ${launch.id}:`, (e as Error).message)
    }
  }
  await db.launchAlert.update({ where: { launchId_threshold: { launchId: launch.id, threshold: minutes } }, data: { sentCount: ok } })
  return ok
}
