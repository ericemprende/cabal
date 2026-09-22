import type { GuideSectionKey } from '@/lib/guide'

/**
 * El escuadrón de Radio Cabal: los diez personajes que atienden a quien llega.
 *
 * Los textos y los roles viven aquí, en código, porque son parte de la voz del
 * producto. Lo que se configura desde el panel de admin es la imagen de cada
 * uno, si está en servicio y quién atiende por defecto — eso va en settings
 * (ver lib/guide-settings.ts) y se mezcla encima de estos valores.
 */

export interface GuideCharacter {
  /** Estable: es lo que se guarda en settings y en el navegador de cada persona. */
  id: string
  /** El distintivo con el que firma. */
  name: string
  /** Qué es, en una palabra. */
  species: string
  /** Su puesto en el escuadrón. */
  role: string
  /** Cómo se presenta la primera vez. */
  greeting: string
  /** La sección que mejor domina: sus consejos salen con más peso ahí. */
  expertise: GuideSectionKey
  /** Foto de perfil. Viene de serie en /public/guide y el panel puede cambiarla. */
  image: string
  /** Fuera de servicio no aparece ni se puede elegir. */
  enabled: boolean
}

/**
 * Los diez, tal y como salen en el arte del escuadrón. El orden es el del
 * cuadro: quien atiende por defecto es el operador de radio, que es quien da
 * nombre a la sección.
 */
export const DEFAULT_CHARACTERS: GuideCharacter[] = [
  {
    id: 'icecomms',
    name: 'IceComms',
    species: 'Pingüino',
    role: 'Operador de radio',
    greeting:
      'Radio Cabal, te escucho fuerte y claro. Soy IceComms y llevo las comunicaciones del escuadrón. Si te pierdes, pregúntame por aquí.',
    expertise: 'radio',
    image: '/guide/icecomms.webp',
    enabled: true,
  },
  {
    id: 'catintel',
    name: 'CatIntel',
    species: 'Gato montés',
    role: 'Investigador',
    greeting:
      'Datos, métricas y alpha. Yo no creo en los proyectos, los verifico. Si quieres saber qué mirar antes de entrar, empieza por mí.',
    expertise: 'tokens',
    image: '/guide/catintel.webp',
    enabled: true,
  },
  {
    id: 'pepescout',
    name: 'PepeScout',
    species: 'Rana',
    role: 'Explorador de launches',
    greeting:
      'Yo los veo venir antes de que existan. El Radar es mi terreno: te enseño a leer una cuenta atrás y a oler un proyecto que va en serio.',
    expertise: 'radar',
    image: '/guide/pepescout.webp',
    enabled: true,
  },
  {
    id: 'shibarecon',
    name: 'ShibaRecon',
    species: 'Shiba inu',
    role: 'Reconocimiento',
    greeting:
      'Voy por delante del pelotón. Te enseño a publicar un lanzamiento como debe ser, con su fecha, su red y su ficha completa.',
    expertise: 'publicar',
    image: '/guide/shibarecon.webp',
    enabled: true,
  },
  {
    id: 'gingersnipe',
    name: 'GingerSnipe',
    species: 'Gato naranja',
    role: 'Tirador',
    greeting:
      'Un disparo, un objetivo. Lo mío son los gráficos y el momento de entrar. Pregúntame por los tokens en vivo.',
    expertise: 'tokens',
    image: '/guide/gingersnipe.webp',
    enabled: true,
  },
  {
    id: 'capycalm',
    name: 'CapyCalm',
    species: 'Capibara',
    role: 'Veterano',
    greeting:
      'Llevo aquí desde antes que casi todos y sigo entero. Si vienes acelerado, siéntate: te explico cómo no perderlo todo en una semana.',
    expertise: 'puntos',
    image: '/guide/capycalm.webp',
    enabled: true,
  },
  {
    id: 'ghostops',
    name: 'GhostOps',
    species: 'Gengar',
    role: 'Operaciones encubiertas',
    greeting:
      'Lo que no se ve también cuenta. Llevo los launches privados y la información que solo se abre con Premium.',
    expertise: 'premium',
    image: '/guide/ghostops.webp',
    enabled: true,
  },
  {
    id: 'bulldozer',
    name: 'BullDozer',
    species: 'Bull terrier',
    role: 'Asalto',
    greeting:
      'Si hay que empujar un proyecto, empujo. Te explico la munición: cómo se compra, cómo se dispara y qué gana el que la usa.',
    expertise: 'municion',
    image: '/guide/bulldozer.webp',
    enabled: true,
  },
  {
    id: 'rabbitdrop',
    name: 'RabbitDrop',
    species: 'Conejo',
    role: 'Alertas rápidas',
    greeting:
      'Yo aviso antes de que salga. Campanitas, recordatorios y avisos: si algo va a lanzarse, lo sabrás a tiempo.',
    expertise: 'radar',
    image: '/guide/rabbitdrop.webp',
    enabled: true,
  },
  {
    id: 'raccoonraid',
    name: 'RaccoonRaid',
    species: 'Mapache',
    role: 'Intendencia',
    greeting:
      'Yo controlo quién aporta y quién solo mira. Puntos, afiliados y clanes: todo lo que suma a tu hoja de servicio.',
    expertise: 'clanes',
    image: '/guide/raccoonraid.webp',
    enabled: true,
  },
]

/** Quién atiende si nadie ha elegido a otro. */
export const DEFAULT_CHARACTER_ID = 'icecomms'

/** Iniciales para el hueco mientras no hay foto subida. */
export function characterInitials(c: Pick<GuideCharacter, 'name'>): string {
  const clean = c.name.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '')
  const caps = clean.match(/[A-ZÁÉÍÓÚÑ]/g)
  if (caps && caps.length >= 2) return caps.slice(0, 2).join('')
  return clean.slice(0, 2).toUpperCase()
}
