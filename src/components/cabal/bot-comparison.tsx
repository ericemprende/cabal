import { Check, Minus, X } from 'lucide-react'

/**
 * Tabla "Cabal vs Phanes" del manual del bot (/bot). Lo de Phanes sale de su
 * web pública (phanes.bot, septiembre 2026). Cuando cambie algo en cualquiera
 * de los dos, se actualiza aquí: una fila falsa en una comparativa se nota.
 */

type Cell = 'yes' | 'partial' | 'no' | string

type Row = { feature: string; detail: string; featureEn: string; detailEn: string; cabal: Cell; phanes: Cell }

type Lang = 'es' | 'en'

const TXT = {
  es: { yes: 'Sí', partial: 'Parcial', no: 'No', feature: 'Función', best: 'Más completo', only: 'Solo en Cabal', note: 'Datos de Phanes según su web pública (phanes.bot), septiembre de 2026. Cabal no sustituye a tu bot actual: puede vivir en el mismo grupo y registrar las calls a nombre de cada uno.' },
  en: { yes: 'Yes', partial: 'Partial', no: 'No', feature: 'Feature', best: 'Most complete', only: 'Only on Cabal', note: 'Phanes data from its public website (phanes.bot), September 2026. Cabal does not replace your current bot: both can live in the same group, with every call recorded under its caller.' },
}

const SHARED: Row[] = [
  { feature: 'First call por grupo', detail: 'Quién llamó cada token primero', featureEn: 'First call per group', detailEn: 'Who called each token first', cabal: 'yes', phanes: 'yes' },
  { feature: 'Ranking del grupo', detail: 'Miembros ordenados por X y aciertos', featureEn: 'Group leaderboard', detailEn: 'Members ranked by X and hit rate', cabal: 'yes', phanes: 'yes' },
  { feature: 'Ranking en la web', detail: 'Tops de callers y comunidades', featureEn: 'Web leaderboard', detailEn: 'Top callers and communities', cabal: 'yes', phanes: 'yes' },
  { feature: 'Alertas de resultado', detail: 'La call hizo 2x, 5x, 10x · DEX pagado', featureEn: 'Result alerts', detailEn: 'The call did 2x, 5x, 10x · DEX paid', cabal: 'yes', phanes: 'yes' },
  { feature: 'Tarjetas de PnL', detail: 'Imagen para compartir el resultado', featureEn: 'PnL cards', detailEn: 'Image to share the result', cabal: 'yes', phanes: 'yes' },
  { feature: 'Arreglar enlaces de X', detail: 'Vista previa completa de los posts', featureEn: 'Fix X links', detailEn: 'Full preview of posts', cabal: 'yes', phanes: 'yes' },
  { feature: 'Bot de Discord', detail: 'Mismos comandos que en Telegram', featureEn: 'Discord bot', detailEn: 'Same commands as on Telegram', cabal: 'yes', phanes: 'yes' },
  { feature: 'Gráficos avanzados', detail: 'Indicadores, varias monedas, CEX', featureEn: 'Advanced charts', detailEn: 'Indicators, multiple coins, CEX', cabal: 'partial', phanes: 'yes' },
  { feature: 'Research', detail: 'Holders, deployer, wallets', featureEn: 'Research', detailEn: 'Holders, deployer, wallets', cabal: 'partial', phanes: 'yes' },
  { feature: 'Idiomas', detail: 'Del bot y de la web', featureEn: 'Languages', detailEn: 'Of the bot and the website', cabal: '2', phanes: '19' },
]

const ONLY_CABAL: Row[] = [
  {
    feature: 'Reputación que viaja contigo',
    detail: 'Tus calls van a tu perfil, no se quedan en un grupo', featureEn: 'Reputation that travels with you', detailEn: 'Your calls go to your profile, not stuck in one group',
    cabal: 'yes',
    phanes: 'no',
  },
  { feature: 'Comprar desde la call', detail: 'Swap integrado en la ficha del token', featureEn: 'Buy from the call', detailEn: 'Swap built into the token page', cabal: 'yes', phanes: 'no' },
  {
    feature: 'Calendario de lanzamientos',
    detail: 'Con recordatorio antes de que salga', featureEn: 'Launch calendar', detailEn: 'With a reminder before it goes live',
    cabal: 'yes',
    phanes: 'no',
  },
  { feature: 'Devs y proyectos verificados', detail: 'Reclamar proyecto, sello y votos', featureEn: 'Verified devs and projects', detailEn: 'Claim a project, badge and votes', cabal: 'yes', phanes: 'no' },
  { feature: 'Feed social', detail: 'Tesis, comentarios y seguir a callers', featureEn: 'Social feed', detailEn: 'Theses, comments and following callers', cabal: 'yes', phanes: 'no' },
]

function Mark({ value, strong, lang }: { value: Cell; strong?: boolean; lang: Lang }) {
  const t = TXT[lang]
  if (value === 'yes') {
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
          strong ? 'bg-primary/25 ring-2 ring-primary/50 text-primary' : 'bg-white/10 text-foreground/70'
        }`}
        aria-label={t.yes}
      >
        <Check className="h-4 w-4" />
      </span>
    )
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-amber-400" aria-label={t.partial}>
        <Minus className="h-4 w-4" />
      </span>
    )
  }
  if (value === 'no') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-foreground/40" aria-label={t.no}>
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
          <th scope="row" className="px-3 py-3 text-left font-normal sm:px-5">
            <span className="block text-[14px] font-medium text-foreground">{lang === 'en' ? r.featureEn : r.feature}</span>
            <span className="block text-[12px] text-foreground/55">{lang === 'en' ? r.detailEn : r.detail}</span>
          </th>
          <td className="bg-primary/5 px-3 py-3 text-center sm:px-5">
            <Mark value={r.cabal} strong lang={lang} />
          </td>
          <td className="px-3 py-3 text-center sm:px-5">
            <Mark value={r.phanes} lang={lang} />
          </td>
        </tr>
      ))}
    </>
  )
}

export function BotComparison({ lang = 'es' }: { lang?: Lang } = {}) {
  const t = TXT[lang]
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className="px-3 py-4 text-left font-semibold text-foreground sm:px-5">
                {t.feature}
              </th>
              <th scope="col" className="bg-primary/10 px-3 py-4 text-center sm:px-5">
                <span className="block font-bold text-primary">Cabal</span>
                <span className="mt-1 inline-block rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  {t.best}
                </span>
              </th>
              <th scope="col" className="px-3 py-4 text-center font-semibold text-foreground/70 sm:px-5">
                Phanes
              </th>
            </tr>
          </thead>
          <tbody>
            <Rows rows={SHARED} lang={lang} />
            <tr className="border-b border-white/10">
              <td colSpan={3} className="px-3 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-primary sm:px-5">
                {t.only}
              </td>
            </tr>
            <Rows rows={ONLY_CABAL} lang={lang} />
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-foreground/50">
        {t.note}
      </p>
    </div>
  )
}
