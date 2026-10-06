import { Download, Hammer, LineChart, Radar, Smartphone, Trophy, Wallet } from 'lucide-react'

/**
 * Bloque de la landing que vende la idea central: en Cabal todo pasa en un
 * solo lugar, empezando por el radar (ves lo que va a salir antes de que
 * salga), y pensado para el móvil porque viene la app nativa.
 */

type Lang = 'es' | 'en'

const TXT = {
  es: {
    title: ['Todo pasa en ', 'un solo lugar'],
    lead: 'Hoy un trader salta entre cinco apps: una para enterarse, otra para ver el gráfico, otra para comprar, un grupo para las calls y X para el ruido. En Cabal lo ves antes, lo analizas, lo compras y lo compartes sin salir.',
    before: 'Antes',
    beforeList: ['DEX Screener para mirar', 'fomo para comprar', 'Telegram para las calls', 'X para enterarte tarde'],
    after: 'Con Cabal',
    afterText: 'Una sola app, de principio a fin.',
    steps: [
      { title: 'El radar: lo ves antes de que pase', body: 'Lanzamientos con fecha y hora, antes de que salgan. Activas la campanita y te avisamos una hora antes.' },
      { title: 'Lo analizas en segundos', body: 'Gráfico en vivo, chequeos de seguridad, historial del dev y tesis de la comunidad en la misma ficha.' },
      { title: 'Lo compras en un toque', body: 'Swap integrado en la ficha del token, en varias cadenas. Sin copiar contratos ni abrir otra web.' },
      { title: 'Lo compartes y te suma', body: 'Tus calls quedan registradas con su resultado, suben tu reputación y te dan insignias y puntos.' },
    ],
    mobileTitle: 'Hecho para el móvil',
    mobileBody: 'Cabal está pensado para usarse con una mano: avisos al instante, compra en un toque y todo a la vista sin menús escondidos. Hoy ya lo puedes instalar como app desde el navegador.',
    mobileSoon: 'App en beta · pronto en App Store y Google Play',
    apkCta: 'Descargar APK Android',
    apkNote: 'Versión beta · Android y Solana Seeker · 2,8 MB. Pronto en App Store y Google Play.',
  },
  en: {
    title: ['Everything happens in ', 'one place'],
    lead: 'Today a trader jumps between five apps: one to find out, one for the chart, one to buy, a group for calls and X for the noise. On Cabal you see it first, analyze it, buy it and share it without leaving.',
    before: 'Before',
    beforeList: ['DEX Screener to watch', 'fomo to buy', 'Telegram for calls', 'X to find out late'],
    after: 'With Cabal',
    afterText: 'One app, start to finish.',
    steps: [
      { title: 'The radar: see it before it happens', body: 'Launches with date and time, before they go live. Tap the bell and we remind you an hour before.' },
      { title: 'Analyze it in seconds', body: 'Live chart, safety checks, dev history and community theses on the same page.' },
      { title: 'Buy it in one tap', body: 'Swap built into the token page, across chains. No copying contracts or opening another site.' },
      { title: 'Share it and level up', body: 'Your calls are recorded with their result, grow your reputation and earn you badges and points.' },
    ],
    mobileTitle: 'Built for mobile',
    mobileBody: 'Cabal is made to be used with one hand: instant alerts, one-tap buys and everything in view with no hidden menus. You can already install it as an app from your browser.',
    mobileSoon: 'App in beta · coming soon to the App Store and Google Play',
    apkCta: 'Download Android APK',
    apkNote: 'Beta version · Android and Solana Seeker · 2.8 MB. Coming soon to the App Store and Google Play.',
  },
}

const STEP_ICONS = [Radar, LineChart, Wallet, Trophy]

export function AllInOne({ lang = 'es' }: { lang?: Lang }) {
  const t = TXT[lang]
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-bold sm:text-3xl">
        {t.title[0]}
        <span className="text-primary">{t.title[1]}</span>
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.lead}</p>

      {/* Antes / con Cabal */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t.before}</p>
          <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
            {t.beforeList.map((x) => (
              <li key={x} className="line-through decoration-white/25">
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-center rounded-2xl border border-[#8FA83F]/40 bg-[#8FA83F]/10 p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{t.after}</p>
          <p className="mt-2 font-display text-xl font-bold">{t.afterText}</p>
        </div>
      </div>

      {/* Los cuatro pasos, en orden */}
      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {t.steps.map((s, i) => {
          const Icon = STEP_ICONS[i]
          return (
            <li key={s.title} className="relative rounded-2xl border border-white/10 bg-[#121410] p-5">
              <span className="absolute right-4 top-4 font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-[15px] font-bold">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          )
        })}
      </ol>

      {/* Móvil y app */}
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-[#8FA83F]/10 to-transparent p-5 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#8FA83F]/30 bg-[#8FA83F]/10">
          <Smartphone className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-[17px] font-bold">
            {t.mobileTitle}
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              <Hammer className="h-3 w-3" aria-hidden /> {t.mobileSoon}
            </span>
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{t.mobileBody}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-center">
          <a
            href="/download/cabal-seeker.apk"
            download
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> {t.apkCta}
            <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-bold uppercase">Beta</span>
          </a>
          <span className="max-w-[16rem] text-[11px] text-muted-foreground sm:text-center">{t.apkNote}</span>
        </div>
      </div>
    </section>
  )
}
