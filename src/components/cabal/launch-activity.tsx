'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { PencilLine, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CountdownPill, TokenGlyph, UserAvatar } from '@/components/cabal/shared'
import { useFeed, useLaunches } from '@/lib/api-client'
import { timeAgo } from '@/lib/cabal'
import type { LaunchDTO, PostDTO } from '@/lib/types'

export type ActivityItem =
  | { type: 'post'; at: number; post: PostDTO }
  | { type: 'launch'; at: number; launch: LaunchDTO; kind: 'created' | 'updated' }

/**
 * Posts, launches recién publicados y ediciones de launches con cambios de
 * verdad (fecha confirmada, descripción, etc.), del más nuevo al más viejo.
 * Los launches salen de /api/launches, que ya excluye los ocultos: no se
 * guardan como posts para no inflar los contadores de comentarios ni de posts
 * del usuario.
 */
export function useActivity(limit: number) {
  const { data: feed, isLoading } = useFeed()
  const { data: launches } = useLaunches()

  const items = useMemo(() => {
    const all: ActivityItem[] = [
      ...(feed ?? []).map((p) => ({ type: 'post' as const, at: +new Date(p.createdAt), post: p })),
      ...(launches ?? []).map((l) => ({ type: 'launch' as const, at: +new Date(l.createdAt), launch: l, kind: 'created' as const })),
      // Solo si la edición dejó una nota: guardar sin cambiar nada no cuenta como actividad
      ...(launches ?? [])
        .filter((l) => l.lastEditedAt && l.lastChangeNote)
        .map((l) => ({ type: 'launch' as const, at: +new Date(l.lastEditedAt!), launch: l, kind: 'updated' as const })),
    ]
    return all.sort((a, b) => b.at - a.at).slice(0, limit)
  }, [feed, launches, limit])

  return { items, isLoading }
}

export function LaunchActivityCard({
  launch: l,
  onOpen,
  compact,
  kind = 'created',
}: {
  launch: LaunchDTO
  onOpen: () => void
  compact?: boolean
  /** 'updated' = se editó el launch (fecha, descripción…): cambia el texto y la marca de tiempo. */
  kind?: 'created' | 'updated'
}) {
  const u = l.createdBy
  const updated = kind === 'updated'
  return (
    <article
      className={cn(
        'card-surface rounded-xl border border-[#8FA83F]/20 transition-colors hover:border-[#8FA83F]/35',
        compact ? 'p-2.5' : 'p-3.5'
      )}
    >
      <div className="flex items-start gap-2.5">
        <Link href={`/u/${u.handle}`} className="shrink-0" aria-label={`Perfil de @${u.handle}`}>
          <UserAvatar name={u.name} handle={u.handle} src={u.avatar} size={compact ? 'sm' : 'md'} verified={u.walletVerified} official={u.verified} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-x-1.5">
            <Link href={`/u/${u.handle}`} className="flex min-w-0 items-center gap-x-1.5 hover:underline">
              <span className={cn('truncate font-semibold', compact ? 'text-[13px]' : 'text-sm')}>{u.name}</span>
              <span className="truncate text-xs text-muted-foreground">@{u.handle}</span>
            </Link>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <span
                className={cn(
                  'flex items-center gap-1 rounded-md border px-1.5 py-px text-[10px] font-semibold',
                  updated ? 'border-amber-300/30 bg-amber-300/12 text-amber-300' : 'border-[#8FA83F]/30 bg-[#8FA83F]/12 text-primary'
                )}
              >
                {updated ? <PencilLine className="h-2.5 w-2.5" aria-hidden /> : <Rocket className="h-2.5 w-2.5" aria-hidden />}
                {updated ? 'Actualización' : 'Launch'}
              </span>
              <span className="text-[11px] text-muted-foreground">{timeAgo(updated ? l.lastEditedAt! : l.createdAt)}</span>
            </span>
          </div>
          <p className={cn('mt-1.5 text-foreground/90', compact ? 'text-[13px]' : 'text-sm')}>
            {updated ? l.lastChangeNote : 'Publicó un nuevo lanzamiento'}
          </p>
          <button
            onClick={onOpen}
            className="mt-2 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition-colors hover:border-[#8FA83F]/35"
          >
            <TokenGlyph src={l.image} ticker={l.ticker ?? l.name} size={compact ? 'xs' : 'sm'} />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
              {l.isPrivate || !l.ticker ? <span className="text-amber-300/90">Privado</span> : l.ticker}{' '}
              <span className="font-normal text-muted-foreground">· {l.name}</span>
            </span>
            {l.status === 'upcoming' ? (
              <CountdownPill target={l.launchAt} size="xs" compact estimated={!l.dateConfirmed} />
            ) : (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-primary">ver en radar →</span>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
