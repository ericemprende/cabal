import type { MeDTO } from '@/lib/types'
import type { TabKey } from '@/lib/store'

/**
 * Lo que sabe el asistente de Radio Cabal: qué es cada sección y qué le falta
 * por hacer a quien acaba de llegar.
 *
 * Es texto plano a propósito. Mañana, cuando haya un chat con IA, este mismo
 * contenido es el que se le pasa como contexto: si la guía y el bot leen de
 * dos sitios distintos, uno de los dos miente.
 */

export type GuideSectionKey =
  | 'radar'
  | 'tokens'
  | 'feed'
  | 'leaderboard'
  | 'radio'
  | 'clanes'
  | 'publicar'
  | 'perfil'
  | 'municion'
  | 'puntos'
  | 'premium'

export interface GuideSection {
  key: GuideSectionKey
  /** Cómo se llama en la interfaz. */
  title: string
  /** Una línea: qué es, sin rodeos. */
  summary: string
  /** Dos o tres frases: cómo se usa de verdad. */
  body: string
  /** El detalle que no es obvio mirando la pantalla. */
  tip: string
  /** A qué pestaña lleva el botón "Llévame ahí", si aplica. */
  tab?: TabKey
  /** Ruta propia, para lo que no vive en una pestaña. */
  href?: string
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    key: 'radar',
    title: 'Radar',
    summary: 'Los lanzamientos que todavía no han salido.',
    body:
      'Es el corazón de Cabal: proyectos posteados por la comunidad antes de que el token exista. Cada tarjeta lleva la cuenta atrás hasta el lanzamiento, la red, quién lo trajo y el hype que está juntando. Los que van marcados como estimados aún no tienen fecha confirmada por el dev.',
    tip: 'La cuenta atrás en rojo significa que sale en menos de una hora. Activa la campanita en un launch y te avisamos una hora antes.',
    tab: 'radar',
  },
  {
    key: 'tokens',
    title: 'Tokens',
    summary: 'Lo que ya está en el mercado, con precio en vivo.',
    body:
      'Cuando un launch sale, pasa aquí con su market cap, su gráfico y el botón de compra. Puedes ordenar por tendencia o por los más recientes, y filtrar por red. Pegar un contrato en el buscador abre su gráfico aunque el token no esté publicado en Cabal.',
    tip: 'El market cap se refresca solo. Si un token te interesa, ábrelo: dentro están el gráfico completo y el historial de quién lo llamó primero.',
    tab: 'tokens',
  },
  {
    key: 'feed',
    title: 'Feed',
    summary: 'Las tesis: por qué alguien cree en un proyecto.',
    body:
      'Aquí se argumenta. Una tesis no es un "esto va a x100", es explicar qué viste. Se puede responder, dar me gusta y citar un launch concreto. Lo que escribes queda firmado con tu perfil y suma a tu reputación.',
    tip: 'Publicar una tesis da puntos Cabal. Las que reciben más me gusta empujan tu posición en Líderes.',
    tab: 'feed',
  },
  {
    key: 'leaderboard',
    title: 'Líderes',
    summary: 'Quién acierta de verdad, con números.',
    body:
      'El ranking no va de quién habla más, va de quién acierta. Cada caller tiene su histórico: cuántas calls hizo, cuántas ganaron y su mejor multiplicador. Puedes filtrar por periodo y por clan.',
    tip: 'Antes de seguir a alguien, mírale el porcentaje de acierto y cuántas calls lleva. Un 100% con dos calls no dice gran cosa.',
    tab: 'leaderboard',
  },
  {
    key: 'radio',
    title: 'Radio Cabal',
    summary: 'El chat en vivo del escuadrón.',
    body:
      'Charlas, alpha y oportunidades en tiempo real. Se ve quién está conectado, se puede responder a un mensaje concreto y te avisamos cuando alguien te contesta. De vez en cuando aparecen avisos del propio Cabal.',
    tip: 'Si te responden, te sale el punto verde en la campanita de arriba. No hace falta tener el chat abierto.',
    tab: 'chat',
  },
  {
    key: 'clanes',
    title: 'Clanes',
    summary: 'Comunidades reales de Telegram y Discord.',
    body:
      'Un clan es un grupo que ya existe fuera de Cabal y que trae aquí sus calls. Cada clan tiene su ranking propio y sus mejores callers. Puedes unirte al Discord del clan desde su ficha.',
    tip: 'Filtrar Líderes por clan te enseña quién manda dentro de cada comunidad, no en toda la plataforma.',
    tab: 'leaderboard',
  },
  {
    key: 'publicar',
    title: 'Publicar un launch',
    summary: 'Traer al radar algo que nadie ha visto.',
    body:
      'El botón verde de arriba abre el formulario. Necesitas el nombre, la red, la fecha estimada y una imagen. Si eres el dev del proyecto puedes marcarlo y reclamar la ficha; si eres un scout que lo encontró, se publica a tu nombre igual.',
    tip: 'Marcar un launch como privado oculta el ticker hasta que salga. Sirve para no quemar un proyecto antes de tiempo.',
    href: '/publicar',
  },
  {
    key: 'perfil',
    title: 'Tu perfil',
    summary: 'Tu cara en el escuadrón.',
    body:
      'Foto, bio y cuentas verificadas. Verificar X, Google o Discord te da puntos y una insignia que se ve en cada cosa que publicas. Tu perfil público enseña tu histórico de calls a cualquiera.',
    tip: 'Un perfil sin foto ni bio recibe muchos menos seguidores. Es lo primero que mira la gente antes de fiarse de una call.',
  },
  {
    key: 'municion',
    title: 'Munición',
    summary: 'Balas para empujar un proyecto.',
    body:
      'La granada de arriba es tu cargador. Cada bala equivale a un minuto de boost: disparas sobre un proyecto y lo subes en la cinta de boosts que ve todo el mundo. Se compran con tarjeta o en cripto.',
    tip: 'El contador te dice cuánto tiempo de boost te queda, no cuántas balas. Mil doscientas balas son veinte horas.',
  },
  {
    key: 'puntos',
    title: 'Puntos Cabal',
    summary: 'Lo que ganas por aportar, canjeable por $CABAL.',
    body:
      'Publicar un launch, escribir una tesis, verificar tus cuentas o traer a alguien con tu enlace de afiliado suma puntos. Se ven en la píldora de arriba y en tu perfil, con el detalle de dónde salió cada uno.',
    tip: 'Los puntos son acumulativos de por vida para el ranking, aunque canjees. Tu posición en Líderes no baja por canjear.',
  },
  {
    key: 'premium',
    title: 'Premium',
    summary: 'La información completa de cada proyecto.',
    body:
      'Con Premium ves la wallet del dev cuando se conoce, el launchpad donde sale el token y el contrato si existe antes del lanzamiento. Además desbloquea valorar a otras personas y la insignia de verificado.',
    tip: 'Se paga con tarjeta o en cripto. En cripto, el acceso se activa cuando la red confirma el pago, no al pulsar el botón.',
  },
]

/** Las misiones de bienvenida: lo que de verdad hace falta para no estar perdido. */
export interface GuideMission {
  id: string
  title: string
  /** Por qué merece la pena, no qué botón pulsar. */
  why: string
  /** Texto del botón que lleva a hacerlo. */
  cta: string
  tab?: TabKey
  href?: string
  /** Abre un diálogo de la app en vez de navegar. */
  opens?: 'profile' | 'premium' | 'ammo' | 'affiliates'
  /** Si ya está hecha, mirando los datos reales de la cuenta. */
  done: (me: MeDTO | undefined) => boolean
}

export const GUIDE_MISSIONS: GuideMission[] = [
  {
    id: 'avatar',
    title: 'Ponte foto y bio',
    why: 'Es lo primero que mira alguien antes de fiarse de una call tuya.',
    cta: 'Editar mi perfil',
    opens: 'profile',
    done: (me) => Boolean(me?.avatar && me.bio && me.bio.trim().length > 0),
  },
  {
    id: 'verify',
    title: 'Verifica una cuenta',
    why: 'X, Google o Discord. Te da la insignia y puntos Cabal al instante.',
    cta: 'Verificar ahora',
    opens: 'profile',
    done: (me) => Boolean(me?.xVerified || me?.googleVerified || me?.discordVerified),
  },
  {
    id: 'radar',
    title: 'Date una vuelta por el Radar',
    why: 'Mira qué sale en las próximas horas y activa la campanita en lo que te interese.',
    cta: 'Ir al Radar',
    tab: 'radar',
    done: () => false,
  },
  {
    id: 'thesis',
    title: 'Escribe tu primera tesis',
    why: 'Explica por qué un proyecto te convence. Suma puntos y construye tu reputación.',
    cta: 'Ir al Feed',
    tab: 'feed',
    done: (me) => (me?.stats.postsCount ?? 0) > 0,
  },
  {
    id: 'launch',
    title: 'Publica un lanzamiento',
    why: 'Trae al radar algo que nadie ha visto todavía. Es lo que más puntos da.',
    cta: 'Publicar launch',
    href: '/publicar',
    done: (me) => (me?.stats.launchesCount ?? 0) > 0,
  },
  {
    id: 'clan',
    title: 'Busca tu clan',
    why: 'Filtra Líderes por clan y mira qué comunidad encaja contigo.',
    cta: 'Ver Líderes',
    tab: 'leaderboard',
    done: () => false,
  },
]

/** Cuántas misiones llevas hechas. Las de "date una vuelta" se marcan al visitarlas. */
export function missionProgress(me: MeDTO | undefined, visited: string[]): { done: number; total: number } {
  const total = GUIDE_MISSIONS.length
  const done = GUIDE_MISSIONS.filter((m) => m.done(me) || visited.includes(m.id)).length
  return { done, total }
}
