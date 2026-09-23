'use client'

import { useState } from 'react'
import { Crown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OfficialBadge } from '@/components/cabal/shared'
import { useMe, useMyVerifyRequests, useRequestVerification } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { useT } from '@/lib/i18n/provider'

/**
 * Pedir la insignia de verificado para el perfil o para un launch propio.
 * Perk Premium: sin Premium lleva al diálogo de planes. El admin la revisa a
 * mano antes de darla (ver /api/admin/verification).
 */
export function VerifyRequestRow({
  kind,
  launchId,
  verified,
}: {
  kind: 'user' | 'launch'
  launchId?: string
  verified: boolean
}) {
  const t = useT()
  const { data: me } = useMe()
  const { setPremiumOpen } = useUI()
  const premium = Boolean(me?.premium.active)
  const { data: requests } = useMyVerifyRequests(Boolean(me) && !verified)
  const request = useRequestVerification()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  const last = requests?.find((r) => r.kind === kind && (kind === 'user' || r.launch?.id === launchId))
  const pending = last?.status === 'pending'
  const what = kind === 'user' ? 'tu perfil' : 'este launch'

  let detail: string
  if (verified) detail = kind === 'user' ? t.verify.userVerified : t.verify.launchVerified
  else if (pending) detail = t.verify.pending
  else if (last?.status === 'rejected') detail = t.verify.rejected
  else if (premium) detail = `Pide la insignia de verificado para ${what}; la revisamos a mano`
  else detail = `Insignia de verificado para ${what} · incluida en Premium`

  return (
    <div className="rounded-xl border border-[#7fe04a]/20 bg-[#7fe04a]/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <OfficialBadge />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{verified ? t.verify.verified : t.verify.official}</p>
          <p className="text-[11px] text-muted-foreground">{detail}</p>
        </div>
        {!verified && !pending && !open && (
          premium ? (
            <Button size="sm" variant="outline" className="shrink-0 text-[12px]" onClick={() => setOpen(true)}>
              Solicitar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1 border-amber-400/40 text-[12px] text-amber-200"
              onClick={() => setPremiumOpen(true)}
            >
              <Crown className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden /> Premium
            </Button>
          )
        )}
      </div>
      {open && !verified && !pending && (
        <form
          className="mt-2.5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            request.mutate(
              { kind, launchId, note },
              {
                onSuccess: () => {
                  setOpen(false)
                  setNote('')
                },
              }
            )
          }}
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder={kind === 'user' ? t.verify.userPlaceholder : t.verify.launchPlaceholder}
            className="h-8 bg-[#0a0b08] text-base sm:text-[12px]"
            aria-label={t.verify.aria}
          />
          <Button type="submit" size="sm" className="shrink-0 text-[12px]" disabled={request.isPending}>
            {request.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.verify.send}
          </Button>
        </form>
      )}
    </div>
  )
}
