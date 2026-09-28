import { Check, Hammer, Minus, X } from 'lucide-react'

/**
 * GigaX es prácticamente un clon de fomo (mismo modelo de app social), así
 * que su columna repite la de fomo.
 *
 * Tabla "Cabal frente a las plataformas" de la landing: fomo, GigaX, DEX
 * Screener, DEXTools, Axiom y GMGN. Sale de sus webs, fichas de tienda y
 * reseñas públicas (septiembre 2026). Lo que en Cabal aún se está
 * construyendo va marcado como "en desarrollo", nunca como hecho: una fila
 * falsa en una comparativa se nota.
 */

type Cell = 'yes' | 'partial' | 'no' | 'dev'

const PLATFORMS = [
  { id: 'cabal', name: 'Cabal', logo: '/bots/cabal.png' },
  { id: 'fomo', name: 'fomo', logo: '/bots/fomo.png' },
  { id: 'gigax', name: 'GigaX', logo: '/bots/gigax.png' },
  { id: 'dexscreener', name: 'DEX Screener', logo: '/bots/dexscreener.png' },
  { id: 'dextools', name: 'DEXTools', logo: '/bots/dextools.png' },
  { id: 'axiom', name: 'Axiom', logo: '/bots/axiom.png' },
  { id: 'gmgn', name: 'GMGN', logo: '/bots/gmgn.png' },
] as const

type Row = {
  es: [string, string]
  en: [string, string]
  /** En el orden de PLATFORMS. */
  v: [Cell, Cell, Cell, Cell, Cell, Cell, Cell]
}

const ONLY_CABAL: Row[] = [
  { es: ['Calendario de lanzamientos', 'Radar de lo que sale, con aviso antes'], en: ['Launch calendar', 'Radar of upcoming launches, with a reminder'], v: ['yes', 'no', 'no', 'no', 'no', 'no', 'no'] },
  { es: ['Calls con resultado medido', 'Cada call guarda su pico y suma a tu reputación'], en: ['Calls with measured results', 'Every call records its peak and builds your reputation'], v: ['yes', 'partial', 'partial', 'no', 'no', 'no', 'partial'] },
  { es: ['Tesis y feed social', 'Análisis, comentarios y seguir a callers'], en: ['Theses and social feed', 'Analysis, comments and following callers'], v: ['yes', 'partial', 'partial', 'no', 'partial', 'no', 'no'] },
  { es: ['Devs y proyectos verificados', 'El dev reclama su proyecto y recibe sello'], en: ['Verified devs and projects', 'Devs claim their project and get a badge'], v: ['yes', 'no', 'no', 'partial', 'partial', 'no', 'no'] },
  { es: ['Bot en Telegram y Discord', 'Calls, ranking y avisos dentro del grupo'], en: ['Telegram and Discord bot', 'Calls, leaderboard and alerts inside the group'], v: ['yes', 'no', 'no', 'partial', 'no', 'no', 'partial'] },
  { es: ['Insignias y puntos', 'Rangos por actividad, acierto y volumen'], en: ['Badges and points', 'Ranks for activity, accuracy and volume'], v: ['yes', 'partial', 'partial', 'no', 'no', 'no', 'no'] },
]

const SHARED: Row[] = [
  { es: ['Gráficos en vivo', 'Velas y operaciones en tiempo real'], en: ['Live charts', 'Real-time candles and trades'], v: ['yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes'] },
  { es: ['Comprar y vender dentro', 'Swap sin salir de la ficha del token'], en: ['Buy and sell in-app', 'Swap without leaving the token page'], v: ['yes', 'yes', 'yes', 'no', 'yes', 'yes', 'yes'] },
  { es: ['Destacar un token (boost)', 'Visibilidad de pago para proyectos'], en: ['Token boosts', 'Paid visibility for projects'], v: ['yes', 'no', 'no', 'yes', 'yes', 'no', 'no'] },
  { es: ['Votos de la comunidad', 'A favor y en contra, con motivo'], en: ['Community votes', 'Up and down votes, with a reason'], v: ['yes', 'no', 'no', 'partial', 'yes', 'no', 'no'] },
  { es: ['Chequeos de seguridad', 'Liquidez, mint y contrato'], en: ['Safety checks', 'Liquidity, mint and contract'], v: ['yes', 'no', 'no', 'partial', 'yes', 'yes', 'yes'] },
  { es: ['Varias cadenas', 'Solana, Base, BNB, Ethereum y más'], en: ['Multichain', 'Solana, Base, BNB, Ethereum and more'], v: ['yes', 'yes', 'yes', 'yes', 'yes', 'partial', 'yes'] },
]

const TO_IMPROVE: Row[] = [
  { es: ['Terminal de trading', 'Pantalla pro para operar rápido'], en: ['Trading terminal', 'Pro screen for fast execution'], v: ['dev', 'no', 'no', 'no', 'partial', 'yes', 'yes'] },
  { es: ['Bots de sniping', 'Entrar en el primer bloque o en la migración'], en: ['Sniping bots', 'Buy on the first block or on migration'], v: ['dev', 'no', 'no', 'no', 'no', 'yes', 'yes'] },
  { es: ['Copy trading automático', 'Copia sola las operaciones de otra wallet'], en: ['Automatic copy trading', 'Mirrors another wallet’s trades on its own'], v: ['dev', 'partial', 'partial', 'no', 'no', 'partial', 'yes'] },
  { es: ['Órdenes límite', 'Comprar o vender a un precio fijado'], en: ['Limit orders', 'Buy or sell at a set price'], v: ['dev', 'no', 'no', 'no', 'no', 'yes', 'yes'] },
  { es: ['Alertas de precio', 'Aviso cuando un token cruza un precio'], en: ['Price alerts', 'Notify when a token crosses a price'], v: ['dev', 'no', 'no', 'yes', 'yes', 'partial', 'yes'] },
  { es: ['Perpetuos con apalancamiento', 'Futuros sobre memecoins'], en: ['Leveraged perps', 'Futures on memecoins'], v: ['no', 'yes', 'yes', 'no', 'no', 'yes', 'no'] },
  { es: ['Comprar con tarjeta o Apple Pay', 'Entrar sin tener cripto antes'], en: ['Buy with card or Apple Pay', 'Get in without owning crypto first'], v: ['dev', 'yes', 'yes', 'no', 'no', 'no', 'no'] },
  { es: ['App nativa iOS y Android', 'En construcción; hoy ya se instala como app web'], en: ['Native iOS and Android app', 'In the works; installable as a web app today'], v: ['dev', 'yes', 'yes', 'yes', 'yes', 'no', 'yes'] },
]

type Lang = 'es' | 'en'

const TXT = {
  es: {
    yes: 'Sí', partial: 'Parcial', no: 'No', dev: 'En desarrollo', feature: 'Función',
    only: 'Lo que solo tiene Cabal', shared: 'Lo básico, también en Cabal', improve: 'Lo que viene y lo que nos falta',
    note: 'Datos de fomo, GigaX, DEX Screener, DEXTools, Axiom y GMGN según sus webs, fichas de tienda y reseñas públicas, septiembre de 2026. «Parcial» quiere decir que existe con límites: por ejemplo, el copy trading de fomo es manual y las alertas de DEX Screener no llevan calls.',
  },
  en: {
    yes: 'Yes', partial: 'Partial', no: 'No', dev: 'In development', feature: 'Feature',
    only: 'Only on Cabal', shared: 'The basics, on Cabal too', improve: 'Coming next, and what we still lack',
    note: 'fomo, GigaX, DEX Screener, DEXTools, Axiom and GMGN data from their websites, store listings and public reviews, September 2026. “Partial” means it exists with limits: for example, fomo’s copy trading is manual and DEX Screener alerts carry no calls.',
  },
}

function Mark({ value, strong, lang }: { value: Cell; strong?: boolean; lang: Lang }) {
  const t = TXT[lang]
  if (value === 'yes') {
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
          strong ? 'bg-primary/25 text-primary ring-2 ring-primary/50' : 'bg-white/10 text-foreground/70'
        }`}
        role="img" aria-label={t.yes}
      >
        <Check className="h-4 w-4" />
      </span>
    )
  }
  if (value === 'dev') {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
        <Hammer className="h-3 w-3" aria-hidden /> {t.dev}
      </span>
    )
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-amber-400" role="img" aria-label={t.partial}>
        <Minus className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-foreground/40" role="img" aria-label={t.no}>
      <X className="h-4 w-4" />
    </span>
  )
}

function Group({ title, rows, lang }: { title: string; rows: Row[]; lang: Lang }) {
  return (
    <>
      <tr className="border-b border-white/10">
        <td
          colSpan={PLATFORMS.length + 1}
          className="sticky left-0 px-3 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-primary sm:px-5"
        >
          {title}
        </td>
      </tr>
      {rows.map((r) => {
        const [feature, detail] = r[lang]
        return (
          <tr key={r.es[0]} className="border-b border-white/10 last:border-0">
            <th scope="row" className="sticky left-0 z-10 bg-[#0e100c] px-3 py-3 text-left font-normal sm:px-5">
              <span className="block text-[14px] font-medium text-foreground">{feature}</span>
              <span className="block text-[12px] text-foreground/55">{detail}</span>
            </th>
            {r.v.map((cell, i) => (
              <td key={PLATFORMS[i].id} className={`px-3 py-3 text-center ${i === 0 ? 'bg-primary/5' : ''}`}>
                <Mark value={cell} strong={i === 0} lang={lang} />
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}

export function PlatformComparison({ lang = 'es' }: { lang?: Lang } = {}) {
  const t = TXT[lang]
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className="sticky left-0 z-10 bg-[#0e100c] px-3 py-4 text-left align-bottom font-semibold text-foreground sm:px-5">
                {t.feature}
              </th>
              {PLATFORMS.map((p, i) => (
                <th
                  key={p.id}
                  scope="col"
                  className={`px-3 py-4 text-center align-bottom ${
                    i === 0 ? 'border-x border-primary/40 bg-primary/10' : 'font-semibold text-foreground/70'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.logo} alt="" className="mx-auto h-9 w-9 rounded-lg object-cover" loading="lazy" />
                  <span className={`mt-2 block whitespace-nowrap ${i === 0 ? 'font-bold text-primary' : ''}`}>{p.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Group title={t.only} rows={ONLY_CABAL} lang={lang} />
            <Group title={t.shared} rows={SHARED} lang={lang} />
            <Group title={t.improve} rows={TO_IMPROVE} lang={lang} />
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-foreground/50">{t.note}</p>
    </div>
  )
}
