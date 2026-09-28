import { Check, Minus, X } from 'lucide-react'

/**
 * Tabla "Cabal frente a los demás bots" del manual del bot (/bot) y de la
 * landing. Lo de Phanes, Rick, TTF, CryptoWhale y Proficy sale de la tabla
 * pública de phanes.bot (septiembre 2026). Cuando cambie algo, se actualiza
 * aquí: una fila falsa en una comparativa se nota.
 */

type Cell = 'yes' | 'partial' | 'no' | string

type BotId = 'cabal' | 'phanes' | 'rick' | 'ttf' | 'whale' | 'proficy'

const BOTS: { id: BotId; name: string; logo: string }[] = [
  { id: 'cabal', name: 'Cabal', logo: '/bots/cabal.png' },
  { id: 'phanes', name: 'Phanes', logo: '/bots/phanes.webp' },
  { id: 'rick', name: 'Rick Bot', logo: '/bots/rick.webp' },
  { id: 'ttf', name: 'TTF Bot', logo: '/bots/ttf.webp' },
  { id: 'whale', name: 'CryptoWhale', logo: '/bots/cryptowhale.webp' },
  { id: 'proficy', name: 'Proficy Bot', logo: '/bots/proficy.webp' },
]

type Row = {
  feature: string
  detail: string
  featureEn: string
  detailEn: string
  /** En el orden de BOTS. */
  v: [Cell, Cell, Cell, Cell, Cell, Cell]
}

const SHARED: Row[] = [
  { feature: 'First call por grupo', detail: 'Quién llamó cada token primero', featureEn: 'First call per group', detailEn: 'Who called each token first', v: ['yes', 'yes', 'yes', 'no', 'no', 'no'] },
  { feature: 'Ranking del grupo', detail: 'Miembros ordenados por X y aciertos', featureEn: 'Group leaderboard', detailEn: 'Members ranked by X and hit rate', v: ['yes', 'yes', 'yes', 'no', 'no', 'no'] },
  { feature: 'Ranking en la web', detail: 'Tops de callers y comunidades', featureEn: 'Web leaderboard', detailEn: 'Top callers and communities', v: ['yes', 'yes', 'partial', 'no', 'no', 'no'] },
  { feature: 'Alertas de resultado', detail: 'La call hizo 2x, 5x, 10x · DEX pagado', featureEn: 'Result alerts', detailEn: 'The call did 2x, 5x, 10x · DEX paid', v: ['yes', 'yes', 'partial', 'no', 'no', 'no'] },
  { feature: 'Tarjetas de PnL', detail: 'Imagen para compartir el resultado', featureEn: 'PnL cards', detailEn: 'Image to share the result', v: ['yes', 'yes', 'yes', 'no', 'no', 'no'] },
  { feature: 'Arreglar enlaces de X', detail: 'Vista previa completa de los posts', featureEn: 'Fix X links', detailEn: 'Full preview of posts', v: ['yes', 'yes', 'yes', 'no', 'no', 'no'] },
  { feature: 'Bot de Discord', detail: 'Mismos comandos que en Telegram', featureEn: 'Discord bot', detailEn: 'Same commands as on Telegram', v: ['yes', 'yes', 'yes', 'no', 'yes', 'no'] },
  { feature: 'Gráficos avanzados', detail: 'Indicadores, varias monedas, CEX', featureEn: 'Advanced charts', detailEn: 'Indicators, multiple coins, CEX', v: ['partial', 'yes', 'partial', 'partial', 'yes', 'no'] },
  { feature: 'Research', detail: 'Holders, deployer, wallets', featureEn: 'Research', detailEn: 'Holders, deployer, wallets', v: ['partial', 'yes', 'yes', 'partial', 'no', 'no'] },
  { feature: 'Idiomas', detail: 'Del bot y de la web', featureEn: 'Languages', detailEn: 'Of the bot and the website', v: ['2', '19', '1', '1', '1', '1'] },
]

const ONLY_CABAL: Row[] = [
  { feature: 'Reputación que viaja contigo', detail: 'Tus calls van a tu perfil, no se quedan en un grupo', featureEn: 'Reputation that travels with you', detailEn: 'Your calls go to your profile, not stuck in one group', v: ['yes', 'no', 'no', 'no', 'no', 'no'] },
  { feature: 'Comprar desde la call', detail: 'Swap integrado en la ficha del token', featureEn: 'Buy from the call', detailEn: 'Swap built into the token page', v: ['yes', 'no', 'no', 'no', 'no', 'no'] },
  { feature: 'Calendario de lanzamientos', detail: 'Con recordatorio antes de que salga', featureEn: 'Launch calendar', detailEn: 'With a reminder before it goes live', v: ['yes', 'no', 'no', 'no', 'no', 'no'] },
  { feature: 'Devs y proyectos verificados', detail: 'Reclamar proyecto, sello y votos', featureEn: 'Verified devs and projects', detailEn: 'Claim a project, badge and votes', v: ['yes', 'no', 'no', 'no', 'no', 'no'] },
  { feature: 'Feed social', detail: 'Tesis, comentarios y seguir a callers', featureEn: 'Social feed', detailEn: 'Theses, comments and following callers', v: ['yes', 'no', 'no', 'no', 'no', 'no'] },
]

type Lang = 'es' | 'en'

const TXT = {
  es: { yes: 'Sí', partial: 'Parcial', no: 'No', feature: 'Función', best: 'Más completo', only: 'Solo en Cabal', note: 'Datos de Phanes, Rick, TTF, CryptoWhale y Proficy según la web pública de Phanes (phanes.bot), septiembre de 2026. Cabal no sustituye a tu bot actual: puede vivir en el mismo grupo y registrar las calls a nombre de cada uno.' },
  en: { yes: 'Yes', partial: 'Partial', no: 'No', feature: 'Feature', best: 'Most complete', only: 'Only on Cabal', note: 'Phanes, Rick, TTF, CryptoWhale and Proficy data from the Phanes public website (phanes.bot), September 2026. Cabal does not replace your current bot: both can live in the same group, with every call recorded under its caller.' },
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
  if (value === 'partial') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-amber-400" role="img" aria-label={t.partial}>
        <Minus className="h-4 w-4" />
      </span>
    )
  }
  if (value === 'no') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-foreground/40" role="img" aria-label={t.no}>
        <X className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[12px] font-bold ${
        strong ? 'bg-primary/25 text-primary ring-2 ring-primary/50' : 'bg-white/10 text-foreground/70'
      }`}
    >
      {value}
    </span>
  )
}

function Rows({ rows, lang }: { rows: Row[]; lang: Lang }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.feature} className="border-b border-white/10 last:border-0">
          <th scope="row" className="sticky left-0 z-10 bg-[#0e100c] px-3 py-3 text-left font-normal sm:px-5">
            <span className="block text-[14px] font-medium text-foreground">{lang === 'en' ? r.featureEn : r.feature}</span>
            <span className="block text-[12px] text-foreground/55">{lang === 'en' ? r.detailEn : r.detail}</span>
          </th>
          {r.v.map((cell, i) => (
            <td key={BOTS[i].id} className={`px-3 py-3 text-center ${i === 0 ? 'bg-primary/5' : ''}`}>
              <Mark value={cell} strong={i === 0} lang={lang} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function BotComparison({ lang = 'es' }: { lang?: Lang } = {}) {
  const t = TXT[lang]
  return (
    <div>
      {/* Seis columnas no caben en el móvil: la tabla se desliza de lado con la
          columna de funciones fija a la izquierda. */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className="sticky left-0 z-10 bg-[#0e100c] px-3 py-4 text-left align-bottom font-semibold text-foreground sm:px-5">
                {t.feature}
              </th>
              {BOTS.map((b, i) => (
                <th
                  key={b.id}
                  scope="col"
                  className={`px-3 py-4 text-center align-bottom ${
                    i === 0 ? 'border-x border-primary/40 bg-primary/10' : 'font-semibold text-foreground/70'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.logo} alt="" className="mx-auto h-9 w-9 rounded-lg object-cover" loading="lazy" />
                  <span className={`mt-2 block whitespace-nowrap ${i === 0 ? 'font-bold text-primary' : ''}`}>{b.name}</span>
                  {i === 0 && (
                    <span className="mt-1 inline-block whitespace-nowrap rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                      {t.best}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Rows rows={SHARED} lang={lang} />
            <tr className="border-b border-white/10">
              <td colSpan={BOTS.length + 1} className="px-3 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-primary sm:px-5">
                {t.only}
              </td>
            </tr>
            <Rows rows={ONLY_CABAL} lang={lang} />
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-foreground/50">{t.note}</p>
    </div>
  )
}
