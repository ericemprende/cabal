import { Check, Minus, X } from 'lucide-react'

/**
 * Tabla "Cabal vs Phanes" del manual del bot (/bot). Lo de Phanes sale de su
 * web pública (phanes.bot, septiembre 2026). Cuando cambie algo en cualquiera
 * de los dos, se actualiza aquí: una fila falsa en una comparativa se nota.
 */

type Cell = 'yes' | 'partial' | 'no' | string

type Row = { feature: string; detail: string; cabal: Cell; phanes: Cell }

const SHARED: Row[] = [
  { feature: 'First call por grupo', detail: 'Quién llamó cada token primero', cabal: 'yes', phanes: 'yes' },
  { feature: 'Ranking del grupo', detail: 'Miembros ordenados por X y aciertos', cabal: 'yes', phanes: 'yes' },
  { feature: 'Ranking en la web', detail: 'Tops de callers y comunidades', cabal: 'yes', phanes: 'yes' },
  { feature: 'Alertas de resultado', detail: 'La call hizo 2x, 5x, 10x · DEX pagado', cabal: 'yes', phanes: 'yes' },
  { feature: 'Tarjetas de PnL', detail: 'Imagen para compartir el resultado', cabal: 'yes', phanes: 'yes' },
  { feature: 'Arreglar enlaces de X', detail: 'Vista previa completa de los posts', cabal: 'yes', phanes: 'yes' },
  { feature: 'Bot de Discord', detail: 'Mismos comandos que en Telegram', cabal: 'yes', phanes: 'yes' },
  { feature: 'Gráficos avanzados', detail: 'Indicadores, varias monedas, CEX', cabal: 'partial', phanes: 'yes' },
  { feature: 'Research', detail: 'Holders, deployer, wallets', cabal: 'partial', phanes: 'yes' },
  { feature: 'Idiomas', detail: 'Del bot y de la web', cabal: '2', phanes: '19' },
]

const ONLY_CABAL: Row[] = [
  {
    feature: 'Reputación que viaja contigo',
    detail: 'Tus calls van a tu perfil, no se quedan en un grupo',
    cabal: 'yes',
    phanes: 'no',
  },
  { feature: 'Comprar desde la call', detail: 'Swap integrado en la ficha del token', cabal: 'yes', phanes: 'no' },
  {
    feature: 'Calendario de lanzamientos',
    detail: 'Con recordatorio antes de que salga',
    cabal: 'yes',
    phanes: 'no',
  },
  { feature: 'Devs y proyectos verificados', detail: 'Reclamar proyecto, sello y votos', cabal: 'yes', phanes: 'no' },
  { feature: 'Feed social', detail: 'Tesis, comentarios y seguir a callers', cabal: 'yes', phanes: 'no' },
]

function Mark({ value, strong }: { value: Cell; strong?: boolean }) {
  if (value === 'yes') {
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
          strong ? 'bg-primary/25 ring-2 ring-primary/50 text-primary' : 'bg-white/10 text-foreground/70'
        }`}
        aria-label="Sí"
      >
        <Check className="h-4 w-4" />
      </span>
    )
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-amber-400" aria-label="Parcial">
        <Minus className="h-4 w-4" />
      </span>
    )
  }
  if (value === 'no') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-foreground/40" aria-label="No">
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

function Rows({ rows }: { rows: Row[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.feature} className="border-b border-white/10 last:border-0">
          <th scope="row" className="px-3 py-3 text-left font-normal sm:px-5">
            <span className="block text-[14px] font-medium text-foreground">{r.feature}</span>
            <span className="block text-[12px] text-foreground/55">{r.detail}</span>
          </th>
          <td className="bg-primary/5 px-3 py-3 text-center sm:px-5">
            <Mark value={r.cabal} strong />
          </td>
          <td className="px-3 py-3 text-center sm:px-5">
            <Mark value={r.phanes} />
          </td>
        </tr>
      ))}
    </>
  )
}

export function BotComparison() {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className="px-3 py-4 text-left font-semibold text-foreground sm:px-5">
                Función
              </th>
              <th scope="col" className="bg-primary/10 px-3 py-4 text-center sm:px-5">
                <span className="block font-bold text-primary">Cabal</span>
                <span className="mt-1 inline-block rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  Más completo
                </span>
              </th>
              <th scope="col" className="px-3 py-4 text-center font-semibold text-foreground/70 sm:px-5">
                Phanes
              </th>
            </tr>
          </thead>
          <tbody>
            <Rows rows={SHARED} />
            <tr className="border-b border-white/10">
              <td colSpan={3} className="px-3 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-primary sm:px-5">
                Solo en Cabal
              </td>
            </tr>
            <Rows rows={ONLY_CABAL} />
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-foreground/50">
        Datos de Phanes según su web pública (phanes.bot), septiembre de 2026. Cabal no sustituye a tu bot actual: puede
        vivir en el mismo grupo y registrar las calls a nombre de cada uno.
      </p>
    </div>
  )
}
