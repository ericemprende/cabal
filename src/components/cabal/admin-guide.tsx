'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Radio, Upload, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { jsonFetch, uploadImage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { characterInitials, type GuideCharacter } from '@/lib/guide-characters'

const KEY = ['admin', 'guide'] as const

type GuideConfigDTO = {
  enabled: boolean
  welcome: boolean
  defaultCharacterId: string
  characters: GuideCharacter[]
}

type Patch = {
  enabled?: boolean
  welcome?: boolean
  defaultCharacterId?: string
  characters?: { id: string; image?: string; enabled?: boolean }[]
}

/**
 * Panel admin → Radio Cabal: el escuadrón que atiende a quien llega. Los
 * nombres, los roles y lo que dicen viven en el código (lib/guide-characters).
 * Aquí se sube la foto de cada uno, se decide quién está en servicio y quién
 * atiende por defecto.
 */
export function AdminGuide({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient()
  const q = useQuery<GuideConfigDTO>({
    queryKey: KEY,
    queryFn: () => jsonFetch('/api/admin/guide'),
    enabled,
  })

  const save = useMutation({
    mutationFn: (patch: Patch) =>
      jsonFetch<GuideConfigDTO>('/api/admin/guide', { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (cfg) => qc.setQueryData(KEY, cfg),
    onError: (e) => toast.error((e as Error).message),
  })

  const [uploading, setUploading] = useState<string | null>(null)

  const cfg = q.data
  if (q.isPending || !cfg) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const pickImage = (id: string) => async (file: File) => {
    setUploading(id)
    try {
      const url = await uploadImage(file)
      await save.mutateAsync({ characters: [{ id, image: url }] })
      toast.success('Foto actualizada')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  const inService = cfg.characters.filter((c) => c.enabled).length
  const withPhoto = cfg.characters.filter((c) => c.image).length

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#0a0b08] p-4">
        <div className="flex items-start gap-2.5">
          <Radio className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">Asistente de Radio Cabal</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              La burbuja de abajo a la derecha que da la bienvenida, explica cada sección y lleva las misiones
              de quien acaba de llegar. {inService} de {cfg.characters.length} en servicio · {withPhoto} con foto.
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px]">
              Mostrar el asistente
              <span className="block text-[11px] text-muted-foreground">Apágalo y desaparece de la app.</span>
            </span>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={(v) => save.mutate({ enabled: v })}
              aria-label="Mostrar el asistente"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px]">
              Abrirse solo en la primera visita
              <span className="block text-[11px] text-muted-foreground">
                La bienvenida sale una vez por navegador, nunca dos.
              </span>
            </span>
            <Switch
              checked={cfg.welcome}
              onCheckedChange={(v) => save.mutate({ welcome: v })}
              aria-label="Abrirse solo en la primera visita"
            />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          El escuadrón · quién atiende
        </p>
        <div className="space-y-2">
          {cfg.characters.map((c) => (
            <CharacterRow
              key={c.id}
              character={c}
              isDefault={c.id === cfg.defaultCharacterId}
              uploading={uploading === c.id}
              busy={save.isPending}
              onToggle={(v) => save.mutate({ characters: [{ id: c.id, enabled: v }] })}
              onMakeDefault={() => save.mutate({ defaultCharacterId: c.id })}
              onUpload={pickImage(c.id)}
              onUrl={(url) => save.mutate({ characters: [{ id: c.id, image: url }] })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CharacterRow({
  character,
  isDefault,
  uploading,
  busy,
  onToggle,
  onMakeDefault,
  onUpload,
  onUrl,
}: {
  character: GuideCharacter
  isDefault: boolean
  uploading: boolean
  busy: boolean
  onToggle: (v: boolean) => void
  onMakeDefault: () => void
  onUpload: (file: File) => void
  onUrl: (url: string) => void
}) {
  const [url, setUrl] = useState('')
  const inputId = `guide-file-${character.id}`

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        character.enabled ? 'border-white/10 bg-[#0a0b08]' : 'border-white/5 bg-[#0a0b08]/50 opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        {character.image ? (
          <img
            src={character.image}
            alt={character.name}
            className="h-14 w-14 shrink-0 rounded-full border border-[#8FA83F]/40 object-cover"
          />
        ) : (
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/5 font-display text-[13px] font-bold text-muted-foreground"
            aria-hidden
          >
            {characterInitials(character)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[14px] font-bold">{character.name}</p>
            {isDefault && (
              <span className="rounded-full border border-[#8FA83F]/40 bg-[#8FA83F]/10 px-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Atiende
              </span>
            )}
            {!character.image && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Sin foto
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            {character.species} · {character.role}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-foreground/70">{character.greeting}</p>
        </div>

        <Switch
          checked={character.enabled}
          onCheckedChange={onToggle}
          disabled={busy}
          aria-label={`${character.name} en servicio`}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ''
          }}
        />
        <Button asChild size="sm" variant="outline" className="gap-1.5 text-[12px]" disabled={uploading}>
          <label htmlFor={inputId} className="cursor-pointer">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {character.image ? 'Cambiar foto' : 'Subir foto'}
          </label>
        </Button>

        <div className="flex min-w-[180px] flex-1 items-center gap-1.5">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="…o pega una URL https"
            className="h-8 text-[12px]"
            aria-label={`URL de la foto de ${character.name}`}
          />
          {url.trim() && (
            <Button
              size="sm"
              className="shrink-0 px-2"
              onClick={() => {
                onUrl(url.trim())
                setUrl('')
              }}
              aria-label="Guardar URL"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {!isDefault && character.enabled && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-[12px] text-muted-foreground"
            onClick={onMakeDefault}
            disabled={busy}
          >
            <UserRound className="h-3.5 w-3.5" /> Que atienda este
          </Button>
        )}
      </div>
    </div>
  )
}
