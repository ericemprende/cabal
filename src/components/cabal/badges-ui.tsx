'use client'

import { useEffect, useState } from 'react'
import { Lock, Share2, Trophy, UserRound } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Chapa, type Metal } from '@/components/cabal/chapa'
import { SILUETAS, type Silueta } from '@/lib/siluetas'
import { useMe } from '@/lib/api-client'
import { useLang } from '@/lib/i18n/provider'
import { useUI } from '@/lib/store'
import type { BadgeDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

// Vitrina completa de insignias y la alerta de "insignia desbloqueada".
// Qué insignias hay y cuándo se ganan lo decide lib/badges.ts.

const TXT = {
  es: {
    all: 'Insignias',
    allOf: (n: number) => `${n} insignia${n === 1 ? '' : 's'} ganada${n === 1 ? '' : 's'}`,
    next: 'Próximos objetivos',
    nextHint: 'Sigue participando para desbloquearlas',
    unlocked: '¡Insignia desbloqueada!',
    congrats: 'Felicitaciones, te ganaste',
    why: 'Por qué la ganaste',
    profile: 'Verla en mi perfil',
    share: 'Compartir en X',
    later: 'Seguir',
    shareText: (l: string) => `Acabo de ganar la insignia "${l}" en Cabal 🎖️`,
    more: (n: number) => `Ver ${n} más`,
  },
  en: {
    all: 'Badges',
    allOf: (n: number) => `${n} badge${n === 1 ? '' : 's'} earned`,
    next: 'Next goals',
    nextHint: 'Keep playing to unlock them',
    unlocked: 'Badge unlocked!',
    congrats: 'Congrats, you earned',
    why: 'Why you earned it',
    profile: 'See it on my profile',
    share: 'Share on X',
    later: 'Continue',
    shareText: (l: string) => `I just earned the "${l}" badge on Cabal 🎖️`,
    more: (n: number) => `See ${n} more`,
  },
}

function useTxt() {
  const [lang] = useLang()
  return TXT[lang === 'en' ? 'en' : 'es']
}

function siluetaDe(b: BadgeDTO): Silueta | null {
  const s = (b.silueta ?? b.icon) as Silueta
  return s in SILUETAS ? s : null
}

export function useBadgesText() {
  return useTxt()
}

/** Lista completa: las ganadas y, si se pasan, las siguientes por conseguir. */
export function BadgesDialog({
  open,
  onOpenChange,
  badges,
  next,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  badges: BadgeDTO[]
  next?: BadgeDTO[]
}) {
  const t = useTxt()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#11130e] sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2 text-lg font-black">
          <Trophy className="h-5 w-5 text-primary" aria-hidden /> {t.all}
        </DialogTitle>
        <DialogDescription>{t.allOf(badges.length)}</DialogDescription>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {badges.map((b) => (
            <BadgeCard key={b.id} badge={b} />
          ))}
        </div>
        {next && next.length > 0 && (
          <>
            <div className="mt-2">
              <p className="text-sm font-bold">{t.next}</p>
              <p className="text-xs text-muted-foreground">{t.nextHint}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {next.map((b) => (
                <BadgeCard key={b.id} badge={b} locked />
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function BadgeCard({ badge, locked }: { badge: BadgeDTO; locked?: boolean }) {
  const s = siluetaDe(badge)
  if (!s) return null
  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center',
        locked ? 'border-white/8 bg-white/[0.02]' : 'border-white/12 bg-[#171a13]'
      )}
    >
      <div className={cn(locked && 'opacity-35 grayscale')}>
        <Chapa silueta={s} metal={(badge.metal ?? 'acero') as Metal} rango={badge.rango} className="h-14 w-14" placa />
      </div>
      {locked && <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
      <p className="text-[13px] font-bold leading-tight">{badge.label}</p>
      <p className="text-[11px] leading-snug text-muted-foreground">{badge.description}</p>
    </div>
  )
}

/**
 * Vigila las insignias de quien está conectado y, cuando aparece una que no
 * había visto, lo felicita a pantalla grande. Lo ya visto se guarda por
 * navegador: la primera vez solo se apunta, para no saludar a las cuentas
 * viejas con todas sus insignias de golpe.
 */
export function BadgeUnlockWatcher() {
  const { data: me } = useMe()
  const { setProfileOpen } = useUI()
  const t = useTxt()
  const [queue, setQueue] = useState<BadgeDTO[]>([])

  useEffect(() => {
    if (!me?.id || !me.badges) return
    const key = `cabal:badges-seen:${me.id}`
    let seen: string[] | null = null
    try {
      const raw = localStorage.getItem(key)
      seen = raw ? (JSON.parse(raw) as string[]) : null
    } catch {
      return
    }
    const ids = me.badges.map((b) => b.id)
    if (seen === null) {
      try {
        localStorage.setItem(key, JSON.stringify(ids))
      } catch {}
      return
    }
    const nuevas = me.badges.filter((b) => !seen!.includes(b.id))
    if (nuevas.length === 0) return
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(new Set([...seen, ...ids]))))
    } catch {}
    setQueue((q) => [...q, ...nuevas.filter((n) => !q.some((x) => x.id === n.id))])
  }, [me?.id, me?.badges])

  const current = queue[0]
  const s = current ? siluetaDe(current) : null
  const close = () => setQueue((q) => q.slice(1))

  const shareUrl = current
    ? `https://x.com/intent/post?${new URLSearchParams({
        text: t.shareText(current.label),
        url: typeof window !== 'undefined' ? `${window.location.origin}/u/${me?.handle ?? ''}` : '',
      }).toString()}`
    : '#'

  return (
    <Dialog open={!!current} onOpenChange={(o) => !o && close()}>
      <DialogContent className="overflow-hidden border-[#8FA83F]/30 bg-[#0f110c] text-center sm:max-w-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_40%,rgba(143,168,63,0.35),transparent_65%)]"
        />
        <DialogTitle className="relative text-xs font-black uppercase tracking-[0.2em] text-primary">{t.unlocked}</DialogTitle>
        {current && s && (
          <div className="relative flex flex-col items-center gap-3">
            <div className="animate-in zoom-in-50 spin-in-12 duration-700">
              <Chapa silueta={s} metal={(current.metal ?? 'acero') as Metal} rango={current.rango} className="h-36 w-36 drop-shadow-[0_0_30px_rgba(143,168,63,0.45)]" placa />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t.congrats}</p>
              <p className="text-2xl font-black">{current.label}</p>
            </div>
            <DialogDescription asChild>
              <div className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t.why}</p>
                <p className="mt-1 text-sm text-foreground">{current.description}</p>
              </div>
            </DialogDescription>
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  close()
                  setProfileOpen(true)
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                <UserRound className="h-4 w-4" aria-hidden /> {t.profile}
              </button>
              <div className="flex gap-2">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-sm font-semibold hover:bg-white/5"
                >
                  <Share2 className="h-4 w-4" aria-hidden /> {t.share}
                </a>
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-lg border border-white/12 px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-white/5"
                >
                  {t.later}
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
