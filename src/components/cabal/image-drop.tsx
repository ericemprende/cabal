'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Link2, Loader2, Trash2, TriangleAlert, X } from 'lucide-react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { displayImageUrl } from '@/lib/remote-image'

const URL_OK = /^https:\/\/\S+$/i

/**
 * Selector de imagen con doble vía: subida de archivo o pegado de URL.
 * El panel de URL siempre ocupa el ancho completo (antes quedaba encerrado en
 * el ancho del logo, 96px, y era imposible pegar/enlazar) y muestra una
 * vista previa en vivo que avisa si el enlace no carga.
 */
export function ImageDrop({
  url,
  onSelect,
  onPickUrl,
  onRemove,
  aspect,
  label,
  hint,
  disabled,
  uploading = false,
}: {
  url: string
  onSelect: (file: File) => void
  onPickUrl: (url: string) => void
  onRemove: () => void
  aspect: 'square' | 'video'
  label: string
  hint: string
  disabled?: boolean
  uploading?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [urlMode, setUrlMode] = useState(false)
  const [draft, setDraft] = useState('')
  const [urlError, setUrlError] = useState('')
  const [previewFailed, setPreviewFailed] = useState(false)

  const square = aspect === 'square'
  const draftTrim = draft.trim()
  const draftValid = URL_OK.test(draftTrim) || draftTrim.startsWith('/uploads/') || draftTrim.startsWith('/seed/')

  const openUrlMode = () => {
    setDraft(url && /^https:\/\//i.test(url) ? url : '')
    setUrlError('')
    setPreviewFailed(false)
    setUrlMode(true)
  }

  const applyUrl = () => {
    const v = draftTrim
    if (!v || disabled) return
    if (!draftValid) {
      setUrlError('La URL debe empezar por https://')
      return
    }
    setUrlError('')
    onPickUrl(v)
    setDraft('')
    setPreviewFailed(false)
    setUrlMode(false)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">
        {label} {!square && <span className="font-normal text-muted-foreground">· opcional</span>}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSelect(f)
          e.target.value = ''
        }}
        aria-label={label}
      />

      {urlMode ? (
        // Panel de URL: SIEMPRE a ancho completo (fix: antes el logo lo limitaba a 96px)
        <div className="w-full space-y-1.5 rounded-xl border border-[#8FA83F]/30 bg-[#0a0b08] p-2.5">
          <div className="flex gap-1.5">
            <Input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setPreviewFailed(false)
                if (urlError) setUrlError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyUrl()
                }
              }}
              placeholder="https://… pega aquí el enlace de la imagen"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              inputMode="url"
              aria-label={`URL de la ${label.toLowerCase()}`}
              className="h-9 bg-transparent font-mono text-base sm:text-xs"
            />
            <Button
              onClick={applyUrl}
              disabled={disabled || !draftTrim}
              className="h-9 shrink-0 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-[#8FA83F]"
            >
              Usar
            </Button>
            <button
              onClick={() => setUrlMode(false)}
              disabled={disabled}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Cancelar URL"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Vista previa en vivo: confirma al instante si el enlace carga */}
          {draftValid && !previewFailed && (
            <div className={cn('relative w-full overflow-hidden rounded-lg border border-white/10 bg-[#121410]', square ? 'h-28' : 'h-24')}>
              <Image
                src={displayImageUrl(draftTrim)}
                alt="Vista previa de la imagen"
                fill
                sizes="480px"
                className="object-contain"
                unoptimized
                onError={() => setPreviewFailed(true)}
              />
            </div>
          )}
          {previewFailed && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#ff8080]">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Esa imagen no carga. Verifica el enlace (debe terminar en .png, .jpg, .webp o .gif) y prueba otro host.
            </p>
          )}

          {urlError && <p className="text-[10px] font-medium text-[#ff8080]">{urlError}</p>}
          <p className="text-[10px] leading-snug text-muted-foreground">
            Enlace directo a la imagen (https://). Ej: i.ibb.co, imgur, CDN del proyecto…
          </p>
        </div>
      ) : url ? (
        <div
          className={cn(
            'group relative overflow-hidden rounded-xl border border-white/10 bg-[#0a0b08]',
            square ? 'h-28 w-28' : 'h-28 w-full'
          )}
        >
          <Image src={displayImageUrl(url)} alt={label} fill sizes="320px" className="object-cover" unoptimized />
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <button
              onClick={openUrlMode}
              disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a0b08]/85 text-zinc-300 backdrop-blur transition-colors hover:text-primary"
              aria-label={`Cambiar URL de ${label.toLowerCase()}`}
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRemove}
              disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a0b08]/85 text-zinc-300 backdrop-blur transition-colors hover:text-[#ff8080]"
              aria-label={`Quitar ${label.toLowerCase()}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#0a0b08] text-xs font-medium text-muted-foreground transition-colors hover:border-[#8FA83F]/40 hover:text-foreground',
              square ? 'h-28' : 'h-24'
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Subiendo…
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4" aria-hidden /> {hint}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={openUrlMode}
            disabled={disabled || uploading}
            className="flex w-full items-center justify-center gap-1 rounded-lg text-[10px] font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <Link2 className="h-3 w-3" aria-hidden /> o pega la URL de la imagen
          </button>
        </>
      )}
      {square && !urlMode && (
        <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP, GIF o foto del móvil · máx 8 MB</p>
      )}
    </div>
  )
}
