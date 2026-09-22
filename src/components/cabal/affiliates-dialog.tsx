'use client'

import { useState } from 'react'
import { Copy, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/cabal/shared'
import { timeAgo } from '@/lib/cabal'
import { useMyAffiliates } from '@/lib/api-client'
import { useUI } from '@/lib/store'

/** Mis afiliados: quiénes entraron con mi enlace y cuántos puntos me dejó cada uno. */
export function AffiliatesDialog() {
  const { affiliatesOpen, setAffiliatesOpen } = useUI()
  const { data, isPending, isError } = useMyAffiliates(affiliatesOpen)
  const [copied, setCopied] = useState(false)

  const link = data?.code ? `${window.location.origin}/app?ref=${data.code}` : ''
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Enlace copiado')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  const list = data?.affiliates ?? []

  return (
    <Dialog open={affiliatesOpen} onOpenChange={setAffiliatesOpen}>
      <DialogContent
        className="max-h-[88dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto border-white/10 bg-[#121410] p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        <div className="border-b border-white/10 p-5">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Users className="h-5 w-5 text-primary" aria-hidden /> Afiliados
          </DialogTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Quien se registra con tu enlace te deja el{' '}
            <span className="font-bold text-primary">{data?.percent ?? 10}%</span> de los puntos que genere.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Afiliados" value={isPending ? '…' : String(list.length)} />
            <Stat label="Puntos generados" value={isPending ? '…' : `+${data?.totalEarned ?? 0}`} accent />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-white/10 bg-[#0a0b08] px-3">
              <span className="truncate font-mono text-xs font-bold text-primary" title={link}>
                {link ? link.replace(/^https?:\/\//, '') : '···'}
              </span>
            </div>
            <Button
              size="sm"
              onClick={copy}
              disabled={!link}
              className="shrink-0 gap-1.5 px-3 text-xs font-bold"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? '¡Copiado!' : 'Copiar'}
            </Button>
          </div>

          {isError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-xs text-[#ff8080]">
              No pudimos cargar tus afiliados. Inténtalo de nuevo.
            </p>
          ) : isPending ? (
            <p className="p-6 text-center text-xs text-muted-foreground">Cargando…</p>
          ) : list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted-foreground">
              Aún no tienes afiliados. Comparte tu enlace para empezar a sumar.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[480px] text-left text-[13px]">
                <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Afiliado</th>
                    <th className="px-3 py-2">Se unió</th>
                    <th className="px-3 py-2 text-right">Sus puntos</th>
                    <th className="px-3 py-2 text-right">Te generó</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {list.map((a) => (
                    <tr key={a.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={a.name} handle={a.handle} src={a.avatar} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{a.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">@{a.xHandle ?? a.handle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{timeAgo(a.joinedAt)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.points}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">
                        <span className="inline-flex items-center gap-0.5">
                          +{a.earnedForMe} <Zap className="h-3 w-3" aria-hidden />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0b08] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={accent ? 'text-lg font-bold tabular-nums text-primary' : 'text-lg font-bold tabular-nums'}>{value}</p>
    </div>
  )
}
