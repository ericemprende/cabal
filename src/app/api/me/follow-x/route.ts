import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sessionUserIdFromCookies } from '@/lib/auth'
import { awardPoints } from '@/lib/api-helpers'
import {
  CABAL_X_HANDLE,
  CABAL_X_URL,
  followCampaignOpen,
  followDeadline,
  followIntentUrl,
  followReason,
  followRuleAmount,
  followShareRuleAmount,
  followVariants,
  type FollowStatusDTO,
  type FollowStep,
} from '@/lib/follow-x'
import { localeFromHeader } from '@/lib/waitlist'

export const dynamic = 'force-dynamic'

/** Pasos ya cobrados por esta cuenta, en una sola consulta. */
async function claimedSteps(userId: string): Promise<{ follow: boolean; share: boolean }> {
  const events = await db.pointEvent.findMany({
    where: { userId, reason: { in: [followReason('follow'), followReason('share')] } },
    select: { reason: true },
  })
  const has = (step: FollowStep) => events.some((e) => e.reason === followReason(step))
  return { follow: has('follow'), share: has('share') }
}

/**
 * GET /api/me/follow-x
 * Estado de la campaña "sigue a @Cabal_app" para quien mira: qué puntos quedan
 * por cobrar, hasta cuándo, y el post listo en los dos idiomas.
 */
export async function GET() {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
  const user = await db.user.findUnique({ where: { id: userId }, select: { handle: true } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const deadline = await followDeadline()
  const dto: FollowStatusDTO = {
    handle: user.handle,
    account: { handle: CABAL_X_HANDLE, url: CABAL_X_URL, intent: followIntentUrl() },
    locale: localeFromHeader((await headers()).get('accept-language')),
    share: followVariants(user.handle),
    bonus: { follow: await followRuleAmount(), share: await followShareRuleAmount() },
    claimed: await claimedSteps(userId),
    deadline: deadline.toISOString(),
    open: Date.now() <= deadline.getTime(),
  }
  return NextResponse.json(dto)
}

/**
 * POST /api/me/follow-x  { step: 'follow' | 'share' }
 * Abona el bonus del paso, una sola vez por cuenta y solo mientras la campaña
 * siga abierta.
 *
 * No se comprueba que la persona siga de verdad la cuenta: la API de X necesita
 * el scope `follows.read` (el nuestro no lo pide) y un plan de pago. Se confía
 * en el clic, igual que el bonus de compartir de la lista de espera. Aquí es
 * donde iría la verificación el día que se pague la API.
 */
export async function POST(req: Request) {
  const userId = await sessionUserIdFromCookies()
  if (!userId) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const step: FollowStep = body?.step === 'share' ? 'share' : 'follow'

  if (!(await followCampaignOpen())) {
    return NextResponse.json(
      { ok: false, pointsEarned: 0, error: 'La campaña ya terminó' },
      { status: 410 }
    )
  }

  const claimed = await claimedSteps(userId)
  if (claimed[step]) return NextResponse.json({ ok: true, pointsEarned: 0, claimed })

  // La tarjeta se publica DESPUÉS de seguir: sin el primer paso no hay segundo,
  // o el post diría que sigue a una cuenta que nunca llegó a seguir.
  if (step === 'share' && !claimed.follow) {
    return NextResponse.json(
      { ok: false, pointsEarned: 0, error: `Sigue antes a @${CABAL_X_HANDLE}` },
      { status: 409 }
    )
  }

  const amount = step === 'follow' ? await followRuleAmount() : await followShareRuleAmount()
  const note =
    step === 'follow'
      ? `Siguió a @${CABAL_X_HANDLE} en X`
      : `Compartió su tarjeta de "sigo a @${CABAL_X_HANDLE}"`
  const pointsEarned = await awardPoints(userId, followReason(step), note, amount)

  return NextResponse.json({ ok: true, pointsEarned, claimed: { ...claimed, [step]: true } })
}
