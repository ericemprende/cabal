'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BadgeCheck, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EmojiAvatar, NetworkBadge } from '@/components/cabal/shared'
import { PostCard } from '@/components/cabal/post-card'
import { fmtMc, fmtNum, fmtPct, fmtPrice, shortWallet, timeAgo } from '@/lib/cabal'
import { useCreatePost, useFollowToggle, useToken } from '@/lib/api-client'
import { useUI } from '@/lib/store'

export function TokenDetailDialog() {
  const { tokenDetailId, openToken } = useUI()
  const { data: token, isLoading } = useToken(tokenDetailId)
  const createPost = useCreatePost()
  const follow = useFollowToggle()
  const [thesis, setThesis] = useState('')

  const chartData = useMemo(
    () =>
      (token?.chart ?? []).map((d) => ({
        t: new Date(d.t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
        mc: d.p,
      })),
    [token]
  )

  return (
    <Dialog
      open={!!tokenDetailId}
      onOpenChange={(v) => {
        if (!v) {
          openToken(null)
          setThesis('')
        }
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto border-[#00ff88]/20 bg-[#0b120d] p-0 sm:max-w-2xl" aria-describedby={undefined}>
        {isLoading || !token ? (
          <div className="space-y-3 p-6">
            <DialogTitle className="sr-only">Detalle del token</DialogTitle>
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-0">
            {/* header */}
            <div className="border-b border-[#00ff88]/12 p-5">
              <DialogTitle className="flex items-start gap-3 text-left">
                <EmojiAvatar emoji={token.emoji} size="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display truncate text-xl font-bold">
                      {token.name} <span className="text-primary text-glow">${token.ticker}</span>
                    </h2>
                    <NetworkBadge network={token.network} />
                    {token.isRug && <span className="rounded bg-[#ff4d5e]/15 px-1.5 py-0.5 text-[10px] font-black text-[#ff8080]">RUG</span>}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-lg font-bold">{fmtPrice(token.price)}</span>
                    <span className={cn('text-sm font-bold', token.change24h >= 0 ? 'text-primary' : 'text-[#ff8080]')}>
                      {fmtPct(token.change24h)} 24h
                    </span>
                    <span className="text-sm font-bold text-foreground/80">{fmtMc(token.mc)} MC</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {shortWallet(token.contract)} · nace {timeAgo(token.launchedAt)} · ATH {fmtMc(token.athMc)}
                  </p>
                </div>
              </DialogTitle>

              {/* chart */}
              <div className="mt-4 h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                      <linearGradient id="mcFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00ff88" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(0,255,136,0.07)" vertical={false} />
                    <XAxis dataKey="t" tick={{ fill: '#7d9484', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={40} />
                    <YAxis
                      tick={{ fill: '#7d9484', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={(v: number) => fmtMc(v)}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{ background: '#0b120d', border: '1px solid rgba(0,255,136,0.25)', borderRadius: 10, fontSize: 12 }}
                      labelStyle={{ color: '#7d9484' }}
                      formatter={(v) => [fmtMc(Number(v)), 'Market Cap']}
                    />
                    <Area type="monotone" dataKey="mc" stroke="#00ff88" strokeWidth={2} fill="url(#mcFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* stats */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Holders" value={fmtNum(token.holders)} />
                <Stat label="Vol 24h" value={fmtMc(token.volume24h)} />
                <Stat label="Top 10" value={`${token.top10Pct}%`} warn={token.top10Pct > 20} />
                <Stat label="Tesis" value={`${token.postsCount} 💬`} />
              </div>
            </div>

            {/* DEV TRACK RECORD — el diferencial */}
            <div className="border-b border-[#00ff88]/12 p-5">
              <p className="pb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                🧾 Historial del dev <span className="text-primary">· verificado por wallet</span>
              </p>
              <div className="flex flex-col gap-3 rounded-xl border border-[#00ff88]/12 bg-[#060a08] p-3.5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5">
                  <EmojiAvatar emoji={token.dev.avatar} size="lg" verified={token.dev.walletVerified} />
                  <div>
                    <p className="flex items-center gap-1 text-sm font-bold">
                      {token.dev.name}
                      {token.dev.walletVerified && <BadgeCheck className="h-4 w-4 text-primary" />}
                    </p>
                    <p className="text-xs text-muted-foreground">@{token.dev.handle}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {shortWallet(token.dev.wallet) || 'sin wallet conectada'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:ml-auto sm:justify-end">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tokens</p>
                    <p className="text-sm font-bold">{token.devStats.tokensLaunched}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rugs</p>
                    <p className={cn('text-sm font-bold', token.devStats.rugs > 0 ? 'text-[#ff8080]' : 'text-primary')}>{token.devStats.rugs}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ret. ATH</p>
                    <p className={cn('text-sm font-bold', token.devStats.avgPerformance >= 50 ? 'text-primary' : 'text-amber-300')}>
                      {token.devStats.avgPerformance}%
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={token.dev.isFollowed ? 'secondary' : 'default'}
                    onClick={() => follow.mutate(token.dev.id)}
                    className={cn(
                      'h-8 rounded-lg text-xs font-bold',
                      !token.dev.isFollowed && 'bg-primary text-primary-foreground hover:bg-[#00ff88]'
                    )}
                  >
                    {token.dev.isFollowed ? 'Siguiendo' : 'Seguir'}
                  </Button>
                </div>
              </div>
              {/* dev tokens timeline */}
              <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
                {token.devHistory.map((d) => (
                  <div
                    key={d.id}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5',
                      d.isRug ? 'border-[#ff4d5e]/25 bg-[#ff4d5e]/5' : 'border-[#00ff88]/15 bg-[#00ff88]/4'
                    )}
                  >
                    <span aria-hidden>{d.emoji}</span>
                    <div>
                      <p className="text-xs font-bold">{d.ticker}</p>
                      <p className="text-[10px] text-muted-foreground">{timeAgo(d.launchedAt)} · {fmtMc(d.mc)}</p>
                    </div>
                    <span className={cn('rounded px-1 py-0.5 text-[9px] font-black', d.isRug ? 'bg-[#ff4d5e]/20 text-[#ff8080]' : 'bg-[#00ff88]/15 text-primary')}>
                      {d.isRug ? 'RUG' : `ATH ${fmtMc(d.athMc)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* theses */}
            <div className="p-5">
              <p className="pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tesis de la comunidad · {token.posts.length}
              </p>
              <div className="mb-3 rounded-xl border border-[#00ff88]/15 bg-[#060a08] p-2.5">
                <Textarea
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  placeholder={`Tu tesis sobre ${token.ticker}: ¿por qué va a subir? (+25 puntos ⚡)`}
                  className="min-h-[64px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
                  aria-label="Escribir tesis"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!thesis.trim() || createPost.isPending}
                    onClick={() => {
                      createPost.mutate(
                        { kind: 'thesis', content: thesis, tokenId: token.id },
                        { onSuccess: () => setThesis('') }
                      )
                    }}
                    className="h-8 gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-[#00ff88]"
                  >
                    <Zap className="h-3 w-3" /> Publicar tesis
                  </Button>
                </div>
              </div>
              <div className="max-h-[40vh] space-y-2.5 overflow-y-auto pr-1">
                {token.posts.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nadie ha publicado tesis todavía. Tú puedes ser el primero 🎓</p>
                )}
                {token.posts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-[#00ff88]/10 bg-[#060a08] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-sm font-bold tabular-nums', warn && 'text-amber-300')}>{value}</p>
    </div>
  )
}
