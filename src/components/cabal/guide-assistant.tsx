'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronRight, Radio, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { jsonFetch, useMe } from '@/lib/api-client'
import { useUI } from '@/lib/store'
import { useGoToTab } from '@/lib/use-go-to-tab'
import { GUIDE_MISSIONS, GUIDE_SECTIONS, missionProgress, type GuideSection } from '@/lib/guide'
import { characterInitials, type GuideCharacter } from '@/lib/guide-characters'

/**
 * El asistente de Radio Cabal: un personaje del escuadrón, abajo a la derecha,
 * que da la bienvenida, explica cada sección y lleva la cuenta de lo que le
 * falta por hacer a quien acaba de llegar.
 *
 * El contenido sale de lib/guide.ts y los personajes de la configuración del
 * panel de admin. Lo que se guarda en el navegador es solo la preferencia de
 * cada persona: a quién eligió y qué ya ha visto.
 */

type GuideFeed = {
  enabled: boolean
  welcome: boolean
  defaultCharacterId: string
  characters: GuideCharacter[]
}

const SEEN_KEY = 'cabal:guide:seen'
const CHAR_KEY = 'cabal:guide:character'
const VISITED_KEY = 'cabal:guide:visited'
/** Margen para que la bienvenida no salte encima de quien acaba de entrar. */
const WELCOME_DELAY_MS = 1800

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* modo privado: solo se pierde la preferencia */
  }
}

type View = 'home' | 'sections' | 'missions' | 'squad'

export function GuideAssistant() {
  const { data } = useQuery<GuideFeed>({
    queryKey: ['guide'],
    queryFn: () => jsonFetch('/api/guide'),
    staleTime: 5 * 60_000,
  })
  const { data: me } = useMe()
  const guideOpen = useUI((s) => s.guideOpen)
  const setGuideOpen = useUI((s) => s.setGuideOpen)

  const [view, setView] = useState<View>('home')
  const [openSection, setOpenSection] = useState<GuideSection | null>(null)
  // Se leen en el primer render y no en un efecto: mientras no llega la
  // configuración el componente no pinta nada, así que no hay desajuste con
  // lo que sirvió el servidor.
  const [characterId, setCharacterId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : read(CHAR_KEY)
  )
  const [visited, setVisited] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = read(VISITED_KEY)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  })
  /** La primera vez el saludo va en grande; después, al grano. */
  const [firstTime, setFirstTime] = useState(false)

  const characters = data?.characters ?? []
  const character = useMemo(() => {
    if (characters.length === 0) return null
    return (
      characters.find((c) => c.id === characterId) ??
      characters.find((c) => c.id === data?.defaultCharacterId) ??
      characters[0]
    )
  }, [characters, characterId, data?.defaultCharacterId])

  // Bienvenida: solo la primera visita de este navegador.
  useEffect(() => {
    if (!data?.enabled || !data.welcome) return
    if (read(SEEN_KEY)) return
    const t = setTimeout(() => {
      const s = useUI.getState()
      const busy =
        s.authOpen || s.premiumOpen || s.ammoOpen || s.profileOpen || s.adminOpen ||
        s.searchOpen || s.donateOpen || s.welcomeShareOpen || !!s.launchDetailId || !!s.tokenDetailId
      if (busy) return
      write(SEEN_KEY, String(Date.now()))
      setFirstTime(true)
      setView('home')
      s.setGuideOpen(true)
    }, WELCOME_DELAY_MS)
    return () => clearTimeout(t)
  }, [data?.enabled, data?.welcome])

  const markVisited = useCallback((id: string) => {
    setVisited((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      write(VISITED_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const open = () => {
    write(SEEN_KEY, String(Date.now()))
    setGuideOpen(true)
  }

  const close = () => {
    setGuideOpen(false)
    setFirstTime(false)
    setView('home')
    setOpenSection(null)
  }

  if (!data?.enabled || !character) return null

  const progress = missionProgress(me, visited)

  return (
    <>
      {!guideOpen && (
        <button
          onClick={open}
          aria-label={`Abrir Radio Cabal, te atiende ${character.name}`}
          className={cn(
            'fixed right-3 z-40 flex items-center gap-2 rounded-full border border-[#8FA83F]/40 bg-[#121410]/95 py-1.5 pl-1.5 pr-3.5 shadow-lg backdrop-blur-md transition-transform hover:scale-[1.03] active:scale-95 md:right-4',
            'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-11'
          )}
        >
          <CharacterAvatar character={character} size={40} />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[12px] font-bold text-primary">Radio Cabal</span>
            <span className="text-[10px] text-muted-foreground">
              {progress.done < progress.total ? `${progress.done}/${progress.total} misiones` : '¿Dudas?'}
            </span>
          </span>
          {progress.done < progress.total && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#121410] bg-primary live-dot" />
          )}
        </button>
      )}

      {guideOpen && (
        <div
          role="dialog"
          aria-label="Radio Cabal"
          className={cn(
            'fixed right-3 z-40 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[#8FA83F]/30 bg-[#121410]/98 shadow-2xl backdrop-blur-md md:right-4',
            'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-11',
            'max-h-[min(34rem,calc(100dvh-9rem))]'
          )}
        >
          {/* Cabecera: quién te atiende */}
          <div className="flex items-center gap-2.5 border-b border-white/10 bg-[#171a13] p-3">
            {view !== 'home' ? (
              <button
                onClick={() => {
                  setView('home')
                  setOpenSection(null)
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <CharacterAvatar character={character} size={36} />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[13px] font-bold">
                <Radio className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                Radio Cabal
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {character.name} · {character.role}
              </p>
            </div>
            <button
              onClick={close}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {openSection ? (
              <SectionDetail section={openSection} onClose={close} onBack={() => setOpenSection(null)} />
            ) : view === 'sections' ? (
              <SectionList onPick={setOpenSection} />
            ) : view === 'missions' ? (
              <MissionList me={me} visited={visited} onDone={markVisited} onClose={close} />
            ) : view === 'squad' ? (
              <SquadList
                characters={characters}
                currentId={character.id}
                onPick={(id) => {
                  setCharacterId(id)
                  write(CHAR_KEY, id)
                  setView('home')
                }}
              />
            ) : (
              <Home
                character={character}
                firstTime={firstTime}
                progress={progress}
                onView={setView}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

function CharacterAvatar({ character, size }: { character: GuideCharacter; size: number }) {
  const style = { width: size, height: size }
  if (character.image) {
    return (
      <img
        src={character.image}
        alt={character.name}
        style={style}
        className="shrink-0 rounded-full border border-[#8FA83F]/40 object-cover"
      />
    )
  }
  return (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full border border-[#8FA83F]/40 bg-[#8FA83F]/15 font-display text-[11px] font-bold text-primary"
      aria-hidden
    >
      {characterInitials(character)}
    </span>
  )
}

function Home({
  character,
  firstTime,
  progress,
  onView,
}: {
  character: GuideCharacter
  firstTime: boolean
  progress: { done: number; total: number }
  onView: (v: View) => void
}) {
  const pending = progress.total - progress.done
  return (
    <div className="p-3">
      <div className="flex gap-2.5 rounded-xl border border-white/10 bg-[#0a0b08] p-3">
        <CharacterAvatar character={character} size={44} />
        <div className="min-w-0">
          <p className="text-[13px] leading-relaxed text-foreground/90">
            {firstTime ? character.greeting : '¿Por dónde quieres que empecemos?'}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <MenuRow
          icon={<Radio className="h-4 w-4 text-primary" aria-hidden />}
          title="Qué hay en cada sección"
          sub="Radar, Tokens, Feed, Líderes y el resto"
          onClick={() => onView('sections')}
        />
        <MenuRow
          icon={<Check className="h-4 w-4 text-primary" aria-hidden />}
          title="Tus misiones"
          sub={pending > 0 ? `Te faltan ${pending} de ${progress.total}` : 'Las tienes todas hechas'}
          onClick={() => onView('missions')}
          badge={pending > 0 ? String(pending) : undefined}
        />
        <MenuRow
          icon={<Users className="h-4 w-4 text-primary" aria-hidden />}
          title="Cambiar de guía"
          sub="Elige quién del escuadrón te atiende"
          onClick={() => onView('squad')}
        />
      </div>
    </div>
  )
}

function MenuRow({
  icon,
  title,
  sub,
  onClick,
  badge,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  onClick: () => void
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] p-3 text-left transition-colors hover:border-[#8FA83F]/30 hover:bg-white/[0.03]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8FA83F]/10">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
      </span>
      {badge && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground">
          {badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}

function SectionList({ onPick }: { onPick: (s: GuideSection) => void }) {
  return (
    <div className="space-y-1.5 p-3">
      <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        La plataforma, por partes
      </p>
      {GUIDE_SECTIONS.map((s) => (
        <button
          key={s.key}
          onClick={() => onPick(s)}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] p-3 text-left transition-colors hover:border-[#8FA83F]/30"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{s.title}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{s.summary}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ))}
    </div>
  )
}

function SectionDetail({
  section,
  onClose,
  onBack,
}: {
  section: GuideSection
  onClose: () => void
  onBack: () => void
}) {
  const goToTab = useGoToTab()
  const router = useRouter()

  const go = () => {
    if (section.href) router.push(section.href)
    else if (section.tab) goToTab(section.tab)
    onClose()
  }

  return (
    <div className="p-3">
      <button onClick={onBack} className="mb-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
        ← Todas las secciones
      </button>
      <h3 className="font-display text-[15px] font-bold">{section.title}</h3>
      <p className="mt-0.5 text-[12px] text-primary">{section.summary}</p>
      <p className="mt-2.5 text-[13px] leading-relaxed text-foreground/85">{section.body}</p>
      <p className="mt-3 rounded-xl border border-[#8FA83F]/25 bg-[#8FA83F]/[0.07] p-3 text-[12.5px] leading-relaxed text-foreground/90">
        <span className="font-bold text-primary">El truco:</span> {section.tip}
      </p>
      {(section.tab || section.href) && (
        <Button
          onClick={go}
          className="mt-3 h-10 w-full rounded-xl bg-primary text-[13px] font-bold text-primary-foreground hover:bg-[#8FA83F]"
        >
          Llévame ahí
        </Button>
      )}
    </div>
  )
}

function MissionList({
  me,
  visited,
  onDone,
  onClose,
}: {
  me: ReturnType<typeof useMe>['data']
  visited: string[]
  onDone: (id: string) => void
  onClose: () => void
}) {
  const goToTab = useGoToTab()
  const router = useRouter()
  const { setProfileOpen, setPremiumOpen, setAffiliatesOpen, openAmmo } = useUI()

  return (
    <div className="space-y-1.5 p-3">
      <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Tu hoja de servicio
      </p>
      {GUIDE_MISSIONS.map((m) => {
        const done = m.done(me) || visited.includes(m.id)
        return (
          <div
            key={m.id}
            className={cn(
              'rounded-xl border p-3 transition-colors',
              done ? 'border-[#8FA83F]/30 bg-[#8FA83F]/[0.06]' : 'border-white/10 bg-[#0a0b08]'
            )}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  done ? 'border-primary bg-primary' : 'border-white/25'
                )}
                aria-hidden
              >
                {done && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={4} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[13px] font-semibold', done && 'text-primary')}>{m.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{m.why}</p>
                {!done && (
                  <button
                    onClick={() => {
                      onDone(m.id)
                      if (m.opens === 'profile') setProfileOpen(true)
                      else if (m.opens === 'premium') setPremiumOpen(true)
                      else if (m.opens === 'affiliates') setAffiliatesOpen(true)
                      else if (m.opens === 'ammo') openAmmo()
                      else if (m.href) router.push(m.href)
                      else if (m.tab) goToTab(m.tab)
                      onClose()
                    }}
                    className="mt-2 text-[12px] font-bold text-primary hover:underline"
                  >
                    {m.cta} →
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SquadList({
  characters,
  currentId,
  onPick,
}: {
  characters: GuideCharacter[]
  currentId: string
  onPick: (id: string) => void
}) {
  return (
    <div className="space-y-1.5 p-3">
      <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        El escuadrón
      </p>
      {characters.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c.id)}
          aria-pressed={c.id === currentId}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
            c.id === currentId
              ? 'border-[#8FA83F]/50 bg-[#8FA83F]/[0.08]'
              : 'border-white/10 bg-[#0a0b08] hover:border-[#8FA83F]/30'
          )}
        >
          <CharacterAvatar character={c} size={38} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{c.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {c.species} · {c.role}
            </span>
          </span>
          {c.id === currentId && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
        </button>
      ))}
    </div>
  )
}
