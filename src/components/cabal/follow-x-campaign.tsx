'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Languages, Send, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { jsonFetch, qk } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { XLogo } from '@/components/cabal/x-logo'
import type { FollowStatusDTO } from '@/lib/follow-x'
import type { Locale } from '@/lib/share-card'

/**
 * Campaña "sigue a @Cabal_app": dos pasos encadenados con su bonus cada uno.
 * Se monta donde la persona ya está mirando sus puntos (perfil) y en la
 * bienvenida, justo después de registrarse.
 *
 * Los puntos se abonan al hacer clic, sin comprobar el follow en la API de X
 * (ver la nota en src/lib/follow-x.ts). El servidor es quien decide si el paso
 * se puede cobrar: aquí solo se pinta el estado que devuelve.
 */
export function FollowXCampaign({ className }: { className?: string }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<FollowStatusDTO>({
    queryKey: ['followX'],
    queryFn: () => jsonFetch('/api/me/follow-x'),
  })
  const [pickedLocale, setLocale] = useState<Locale | null>(null)

  const claim = useMutation({
    mutationFn: (step: 'follow' | 'share') =>
      jsonFetch<{ ok: boolean; pointsEarned: number }>('/api/me/follow-x', {
        method: 'POST',
        body: JSON.stringify({ step }),
      }),
    onSuccess: (res) => {
      if (res.pointsEarned > 0) {
        toast.success(`+${res.pointsEarned} puntos Cabal`, {
          description: 'Gracias por sumar al escuadrón',
        })
      }
      qc.invalidateQueries({ queryKey: ['followX'] })
      qc.invalidateQueries({ queryKey: qk.me })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <Skeleton className={cn('h-56 w-full rounded-xl', className)} />
  if (!data) return null

  const locale = pickedLocale ?? data.locale
  const other: Locale = locale === 'es' ? 'en' : 'es'
  const post = data.share[locale]
  const done = data.claimed.follow && data.claimed.share

  // La campaña cerrada solo se sigue enseñando a quien todavía no cobró nada:
  // a los demás no les aporta, y el enlace a la cuenta ya vive en el pie.
  if (!data.open && !done && !data.claimed.follow) return null

  const deadline = new Date(data.deadline).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  })
  const total = data.bonus.follow + data.bonus.share

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-[#8FA83F]/25 bg-gradient-to-br from-[#8FA83F]/10 to-transparent',
        className
      )}
    >
      <header className="flex items-start gap-3 p-4 pb-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0a0b08]"
          aria-hidden
        >
          <XLogo className="h-4 w-4 text-foreground" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold">
            {done ? '¡Listo! Ya eres parte del radar en X' : `Gana ${total} puntos con @${data.account.handle}`}
          </h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {done ? (
              <>
                Sigues a{' '}
                <a
                  href={data.account.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  @{data.account.handle}
                </a>{' '}
                y ya compartiste tu tarjeta. Los {total} puntos están en tu balance.
              </>
            ) : data.open ? (
              <>
                Sigue la cuenta oficial antes del{' '}
                <span className="font-bold text-primary">{deadline}</span> y comparte tu tarjeta.
                Cada paso suma por separado.
              </>
            ) : (
              <>La campaña cerró el {deadline}. Te queda por cobrar el paso que dejaste a medias.</>
            )}
          </p>
        </div>
      </header>

      <div className="space-y-2 px-4 pb-4">
        {/* Paso 1 — seguir */}
        <Step
          n={1}
          label={`Sigue a @${data.account.handle}`}
          bonus={data.bonus.follow}
          claimed={data.claimed.follow}
          disabled={!data.open || claim.isPending}
          icon={<UserPlus className="h-4 w-4" aria-hidden />}
          href={data.account.intent}
          onClaim={() => claim.mutate('follow')}
        />

        {/* Paso 2 — compartir la tarjeta */}
        <Step
          n={2}
          label="Comparte tu tarjeta"
          bonus={data.bonus.share}
          claimed={data.claimed.share}
          disabled={!data.claimed.follow || !data.open || claim.isPending}
          hint={!data.claimed.follow ? 'Primero completa el paso 1' : undefined}
          icon={<Send className="h-4 w-4" aria-hidden />}
          href={post.intent}
          onClaim={() => claim.mutate('share')}
        />

        {/* Vista previa del post: lo mismo que verá X al publicarlo. */}
        {!data.claimed.share && (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0b08]">
            <div className="p-3.5 pb-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Tu post
                </p>
                <button
                  type="button"
                  onClick={() => setLocale(other)}
                  className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Languages className="h-3 w-3" aria-hidden />
                  {other === 'en' ? 'English' : 'Español'}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed">{post.text}</p>
              <p className="mt-1.5 truncate text-[12.5px] text-primary">{post.url}</p>
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
        )}
      </div>
    </section>
  )
}

/** Una fila de paso: abre X en una pestaña nueva y abona el bonus al volver. */
function Step({
  n,
  label,
  bonus,
  claimed,
  disabled,
  hint,
  icon,
  href,
  onClaim,
}: {
  n: number
  label: string
  bonus: number
  claimed: boolean
  disabled: boolean
  hint?: string
  icon: React.ReactNode
  href: string
  onClaim: () => void
}) {
  if (claimed) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-[#8FA83F]/25 bg-[#8FA83F]/8 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground line-through">
          {label}
        </span>
        <span className="font-mono text-[12px] font-bold text-primary">+{bonus}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 font-mono text-[11px] font-bold text-muted-foreground"
        aria-hidden
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold">{label}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Button
        asChild={!disabled}
        disabled={disabled}
        size="sm"
        onClick={disabled ? undefined : onClaim}
        className="shrink-0 gap-1.5 text-[12.5px] font-bold"
      >
        {disabled ? (
          <span className="flex items-center gap-1.5">
            {icon}
            <span className="font-mono">+{bonus}</span>
          </span>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {icon}
            <span className="font-mono">+{bonus}</span>
          </a>
        )}
      </Button>
    </div>
  )
}
