'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Languages, Send, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { jsonFetch, qk } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { FollowXCampaign } from '@/components/cabal/follow-x-campaign'
import type { Locale, ShareVariant } from '@/lib/waitlist'

type ShareInfo = {
  handle: string
  locale: Locale
  share: Record<Locale, ShareVariant>
  shareBonus: number
  shared: boolean
}

/**
 * Bienvenida tras crear cuenta en la app (formulario, X o Google): igual que al
 * final de la whitelist, invita a publicar en X que ya está dentro a cambio de
 * los puntos por difundir. Se puede saltar y entrar directo.
 */
export function WelcomeShareDialog() {
  const { welcomeShareOpen, setWelcomeShareOpen } = useUI()
  const qc = useQueryClient()
  const info = useQuery<ShareInfo>({
    queryKey: ['meShare'],
    queryFn: () => jsonFetch('/api/me/share'),
    enabled: welcomeShareOpen,
  })
  const [pickedLocale, setLocale] = useState<Locale | null>(null)

  const markShared = useMutation({
    mutationFn: () => jsonFetch<{ ok: boolean; pointsEarned: number }>('/api/me/share', { method: 'POST' }),
    onSuccess: (res) => {
      if (res.pointsEarned > 0) {
        toast.success(`+${res.pointsEarned} puntos Cabal`, { description: 'Gracias por difundir el escuadrón' })
      }
      qc.invalidateQueries({ queryKey: qk.me })
      setWelcomeShareOpen(false)
    },
    onError: () => setWelcomeShareOpen(false),
  })

  const data = info.data
  const locale = pickedLocale ?? data?.locale ?? 'es'
  const other: Locale = locale === 'es' ? 'en' : 'es'
  const post = data?.share[locale]

  return (
    <Dialog open={welcomeShareOpen} onOpenChange={setWelcomeShareOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
          <DialogTitle className="font-display text-xl font-bold">
            Ya estás dentro{data ? `, @${data.handle}` : ''}
          </DialogTitle>
        </div>
        <DialogDescription className="sr-only">Comparte en X que te uniste a Cabal</DialogDescription>

        {!data || !post ? (
          <Skeleton className="h-[320px] w-full rounded-xl" />
        ) : (
          <>
            {!data.shared && (
              <div className="flex items-start gap-3 rounded-xl border border-[#8FA83F]/40 bg-[#8FA83F]/10 p-4">
                <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-[14px] font-bold text-primary">Gana tus primeros {data.shareBonus} puntos</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                    Avísale al mundo que haces parte de Cabal Army: comparte tu post en X y se te abonan{' '}
                    {data.shareBonus} puntos Cabal al instante.
                  </p>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0b08]">
              <div className="p-4 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tu post</p>
                  <button
                    type="button"
                    onClick={() => setLocale(other)}
                    className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Languages className="h-3 w-3" aria-hidden />
                    {other === 'en' ? 'English' : 'Español'}
                  </button>
                </div>
                <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed">{post.text}</p>
                <p className="mt-2 truncate text-[13px] text-primary">{post.url}</p>
              </div>
              <img
                key={post.card}
                src={post.card}
                alt={`Tarjeta de @${data.handle} para compartir en X`}
                width={1672}
                height={941}
                className="w-full border-t border-white/10"
              />
            </div>

            <Button
              asChild
              onClick={() => (data.shared ? setWelcomeShareOpen(false) : markShared.mutate())}
              className="h-12 w-full gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground hover:bg-[#9dba46]"
            >
              <a href={post.intent} target="_blank" rel="noopener noreferrer">
                <Send className="h-4 w-4" aria-hidden /> Compartir en X
                {!data.shared && <span className="font-mono">+{data.shareBonus}</span>}
              </a>
            </Button>

            {/* Y de paso, los puntos por seguir la cuenta oficial */}
            <FollowXCampaign />
          </>
        )}

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setWelcomeShareOpen(false)}>
          Saltar y entrar a la app
        </Button>
      </DialogContent>
    </Dialog>
  )
}
