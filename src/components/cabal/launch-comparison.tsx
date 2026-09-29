/**
 * Landing: pump.fun frente a Cabal Launch, para quien va a lanzar un token.
 *
 * Las cifras de pump.fun son las de su programa en la red (septiembre de 2026:
 * 1,25 % por operación, 0,30 % para el creador). Las de Cabal Launch salen de
 * su configuración (lib/cabal-launch.ts): 1 % por operación y 0,56 % para el
 * dev. A propósito, la tabla solo habla de lo que le importa a quien lanza: no
 * enseña la infraestructura ni cuánto se queda Cabal.
 */

type Lang = 'es' | 'en'

type Row = { es: [string, string]; en: [string, string]; pump: { es: string; en: string }; cabal: { es: string; en: string }; win?: boolean }

const ROWS: Row[] = [
  {
    es: ['Comisión por operación', 'Lo que paga quien compra o vende'],
    en: ['Fee per trade', 'What buyers and sellers pay'],
    pump: { es: '1,25 %', en: '1.25%' },
    cabal: { es: '1 %', en: '1%' },
    win: true,
  },
  {
    es: ['Para el dev en cada operación', 'Lo que cobra quien lanzó el token'],
    en: ['Dev share of every trade', 'What the token creator earns'],
    pump: { es: '0,30 %', en: '0.30%' },
    cabal: { es: '0,56 %: casi el doble', en: '0.56%: almost double' },
    win: true,
  },
  {
    es: ['Cobrar tus comisiones', 'Desde dónde las reclamas'],
    en: ['Collecting your fees', 'Where you claim them'],
    pump: { es: 'En pump.fun', en: 'On pump.fun' },
    cabal: { es: 'Un botón en Cabal, directo a tu wallet', en: 'One button in Cabal, straight to your wallet' },
    win: true,
  },
  {
    es: ['Tras graduarse', 'Cuando el token completa la curva'],
    en: ['After graduation', 'When the token completes the curve'],
    pump: { es: 'Pasa a PumpSwap', en: 'Moves to PumpSwap' },
    cabal: {
      es: 'Liquidez bloqueada para siempre y sigues cobrando comisiones',
      en: 'Liquidity locked forever and you keep earning fees',
    },
    win: true,
  },
  {
    es: ['Programar el lanzamiento', 'Que salga solo a la hora exacta'],
    en: ['Scheduled launch', 'Goes live by itself at the exact time'],
    pump: { es: 'No', en: 'No' },
    cabal: { es: 'Sí', en: 'Yes' },
    win: true,
  },
  {
    es: ['En el Radar al instante', 'Con su ficha, gráfico y chat'],
    en: ['On the Radar instantly', 'With its page, chart and chat'],
    pump: { es: 'Hay que publicarlo aparte', en: 'Has to be posted separately' },
    cabal: { es: 'Automático', en: 'Automatic' },
    win: true,
  },
  {
    es: ['Audiencia desde el primer minuto', 'Traders mirando el token nuevo'],
    en: ['Audience from minute one', 'Traders watching new tokens'],
    pump: { es: 'La de pump.fun, enorme', en: "pump.fun's, huge" },
    cabal: { es: 'La comunidad de Cabal, creciendo', en: 'The Cabal community, growing' },
  },
]

const TXT = {
  es: { feature: 'Para quien lanza', note: 'Cifras de pump.fun leídas de su programa en la red, septiembre de 2026. Porcentajes sobre el volumen de cada compra y venta del token.' },
  en: { feature: 'For the creator', note: 'pump.fun figures read from its on-chain program, September 2026. Percentages of the volume of every buy and sell of the token.' },
}

export function LaunchComparison({ lang = 'es' }: { lang?: Lang }) {
  const t = TXT[lang]
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className="sticky left-0 z-10 bg-[#0e100c] px-3 py-4 text-left align-bottom font-semibold text-foreground sm:px-5">
                {t.feature}
              </th>
              <th scope="col" className="px-3 py-4 text-center align-bottom font-semibold text-foreground/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/launchpads/pump.png" alt="" className="mx-auto h-9 w-9 rounded-lg object-cover" loading="lazy" />
                <span className="mt-2 block">pump.fun</span>
              </th>
              <th scope="col" className="border-x border-amber-400/40 bg-amber-400/10 px-3 py-4 text-center align-bottom">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/cabal-logo.png" alt="" className="mx-auto h-9 w-9 rounded-lg object-cover" loading="lazy" />
                <span className="mt-2 block font-bold text-amber-300">Cabal Launch</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const [feature, detail] = r[lang]
              return (
                <tr key={r.es[0]} className="border-b border-white/10 last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-[#0e100c] px-3 py-3 text-left font-normal sm:px-5">
                    <span className="block text-[14px] font-medium text-foreground">{feature}</span>
                    <span className="block text-[12px] text-foreground/55">{detail}</span>
                  </th>
                  <td className="px-3 py-3 text-center text-foreground/70">{r.pump[lang]}</td>
                  <td className={`bg-amber-400/5 px-3 py-3 text-center ${r.win ? 'font-bold text-amber-300' : 'text-foreground/80'}`}>
                    {r.cabal[lang]}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-foreground/45">{t.note}</p>
    </div>
  )
}
