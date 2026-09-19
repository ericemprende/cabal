import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/cabal/legal-page'
import { siteUrl } from '@/lib/waitlist'
import { REMINDER_LEADS, leadLabel } from '@/lib/notify-types'
import { MAX_TOKEN_FILTER } from '@/lib/token-filter'

/**
 * Manual público del bot de Cabal (Telegram y Discord). El panel y el /help
 * del bot enlazan aquí. Cada cambio en los bots (comandos, avisos, ajustes)
 * debe reflejarse en esta página y en UPDATED_AT.
 */
const UPDATED_AT = '19 de septiembre de 2026'

export const metadata: Metadata = {
  title: 'Bot de Cabal — Manual de Telegram y Discord',
  description:
    'Cómo conectar el bot de Cabal en Telegram y Discord, qué hace cada comando y cómo elegir qué avisos te llegan.',
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: '/bot' },
  robots: { index: true, follow: true },
}

type Command = {
  name: string
  usage: string
  what: string
  who: string
  aliases?: string
}

const COMMANDS: Command[] = [
  {
    name: 'start',
    usage: '/start',
    what: 'Saluda y explica cómo conectar el chat. Con un código (/start CÓDIGO) conecta el chat con tu cuenta de Cabal.',
    who: 'Cualquiera',
  },
  {
    name: 'link',
    usage: '/link CÓDIGO',
    what: 'Conecta este chat (privado, grupo, canal o canal de Discord) con tu cuenta de Cabal usando el código que genera tu perfil. El código sirve una vez y caduca.',
    who: 'En grupos y servidores: un administrador',
    aliases: '/vincular',
  },
  {
    name: 'settings',
    usage: '/settings',
    what: 'Abre los botones para elegir qué avisos llegan a este chat, cuánto antes avisar de cada launch y el idioma.',
    who: 'Ver: cualquiera · Cambiar: quien lo conectó o un administrador',
    aliases: '/ajustes, /config',
  },
  {
    name: 'upcoming',
    usage: '/upcoming',
    what: 'Lista los próximos lanzamientos publicados en Cabal.',
    who: 'Cualquiera',
    aliases: '/proximos',
  },
  {
    name: 'call',
    usage: '/call CONTRATO [tu tesis]',
    what: 'Publica una call de ese token en Cabal a tu nombre. Se guarda el precio y el market cap del momento exacto: el resultado de la call (pico y X actual) se mide desde ahí.',
    who: 'Quien tenga su cuenta conectada al bot por privado',
    aliases: '/llamada',
  },
  {
    name: 'pnl',
    usage: '/pnl CONTRATO',
    what: 'Tarjeta con cómo va tu call de ese token: entrada, ahora y pico.',
    who: 'Quien tenga su cuenta conectada al bot por privado',
  },
  {
    name: 'leaderboard',
    usage: '/leaderboard [24h | 7d | 30d | all]',
    what: 'Top Callers y mejores calls de esta comunidad (en el privado, de todo Cabal).',
    who: 'Cualquiera',
    aliases: '/ranking, /lb',
  },
  {
    name: 'filter',
    usage: '/filter [CONTRATO | $TICKER | off]',
    what: `Sin nada, enseña el filtro por token del chat. Con un contrato o $TICKER lo añade (o lo quita si ya estaba). Con "off" lo borra. Máximo ${MAX_TOKEN_FILTER} tokens.`,
    who: 'Ver: cualquiera · Cambiar: quien lo conectó o un administrador',
    aliases: '/filtro',
  },
  {
    name: 'language',
    usage: '/language',
    what: 'Cambia el idioma del bot en este chat: español o inglés.',
    who: 'Quien lo conectó o un administrador',
    aliases: '/idioma',
  },
  {
    name: 'unlink',
    usage: '/unlink',
    what: 'Desconecta este chat: deja de recibir avisos. Se puede volver a conectar cuando quieras.',
    who: 'Quien lo conectó o un administrador',
    aliases: '/desvincular',
  },
  {
    name: 'help',
    usage: '/help',
    what: 'Recuerda cómo funciona el bot y enlaza a este manual.',
    who: 'Cualquiera',
    aliases: '/ayuda',
  },
]

const ALERTS: { name: string; what: string; def: string }[] = [
  {
    name: 'Lanzamientos nuevos',
    what: 'Cada launch nuevo que se publica en Cabal.',
    def: 'Activado en grupos, desactivado en privado',
  },
  {
    name: 'Aviso antes de cada launch',
    what: 'Un recordatorio antes de que salga cada launch, con la antelación que elijas.',
    def: 'Activado en grupos, desactivado en privado',
  },
  { name: 'Calls nuevas de Cabal', what: 'Las calls que publica la comunidad (desde la web u otros chats).', def: 'Desactivado' },
  { name: 'Tesis nuevas', what: 'Las tesis nuevas del feed.', def: 'Desactivado' },
  {
    name: 'Solo de gente que sigo',
    what: 'Filtra los avisos anteriores: solo llegan los de cuentas que sigue quien conectó el chat (y los suyos propios).',
    def: 'Desactivado',
  },
]

export default function BotManualPage() {
  const app = `${siteUrl()}/app`
  return (
    <LegalPage title="Bot de Cabal: manual" updatedAt={UPDATED_AT}>
      <p>
        El bot de Cabal te lleva los avisos de la plataforma a <strong>Telegram</strong> y{' '}
        <strong>Discord</strong>: lanzamientos, recordatorios de la 🔔 campanita, calls y tesis de la comunidad. También
        puedes dar calls, ver cómo van y consultar el ranking sin salir del chat. Los comandos son los mismos en los dos.
      </p>

      <LegalSection title="1. Conectar el bot">
        <p>
          Todo empieza en <a href={app}>Cabal</a> → tu perfil → sección <strong>Telegram</strong> o{' '}
          <strong>Discord</strong>. Allí generas un código de un solo uso que conecta el chat con tu cuenta.
        </p>
        <h3 className="font-semibold text-foreground">Telegram</h3>
        <ul>
          <li>
            <strong>Tu privado:</strong> pulsa «Conectar mi Telegram». Se abre el bot con el código ya puesto: pulsa
            Iniciar y listo.
          </li>
          <li>
            <strong>Un grupo:</strong> pulsa «Añadir a un grupo o canal», abre el enlace «Añade el bot a tu grupo» y hazlo
            administrador. Se conecta solo con tu código.
          </li>
          <li>
            <strong>Un canal</strong> (o si el grupo no se conectó): añade el bot como administrador y publica en el chat
            el comando <code>/link CÓDIGO</code> que te enseña el perfil.
          </li>
        </ul>
        <h3 className="font-semibold text-foreground">Discord</h3>
        <ul>
          <li>
            <strong>Tu privado:</strong> genera el código, abre un mensaje directo con el bot y escríbele{' '}
            <code>/link CÓDIGO</code>.
          </li>
          <li>
            <strong>Un servidor:</strong> añade el bot con el enlace del perfil y, en el canal donde quieras los avisos,
            escribe <code>/link CÓDIGO</code>. Hace falta el permiso «Gestionar servidor».
          </li>
        </ul>
        <p>
          Conectar tu <strong>privado</strong> es lo que te identifica ante el bot: sin él no puedes dar calls con{' '}
          <code>/call</code> ni ver tu <code>/pnl</code>, tampoco desde un grupo.
        </p>
      </LegalSection>

      <LegalSection title="2. Comandos">
        <div className="space-y-3">
          {COMMANDS.map((c) => (
            <div key={c.name} className="rounded-xl border border-white/10 p-4">
              <p className="font-mono text-[14px] font-bold text-primary">{c.usage}</p>
              <p className="mt-1 text-foreground/90">{c.what}</p>
              <p className="mt-1 text-[13px]">
                <strong className="text-foreground/80">Quién:</strong> {c.who}
                {c.aliases && (
                  <>
                    {' · '}
                    <strong className="text-foreground/80">También:</strong> {c.aliases} (solo Telegram)
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
        <p>
          En Discord las respuestas de ajustes solo las ve quien escribió el comando, para no llenar el canal; lo que
          interesa a todos (<code>/upcoming</code>, una call) se ve en el canal.
        </p>
      </LegalSection>

      <LegalSection title="3. Pegar un contrato">
        <p>
          En un chat conectado basta con <strong>pegar el contrato (CA)</strong> de un token, sin comando. El bot responde
          con la ficha del token (precio, market cap, liquidez) y, si tienes tu cuenta conectada, lo cuenta como call
          tuya, igual que <code>/call</code>. Si el token ya se había llamado en esa comunidad, el bot recuerda quién fue
          el primero y en qué market cap.
        </p>
      </LegalSection>

      <LegalSection title="4. Qué avisos llegan">
        <p>
          Cada chat elige los suyos con <code>/settings</code> o desde tu perfil en Cabal (los cambios valen en los dos
          sitios):
        </p>
        <div className="space-y-2">
          {ALERTS.map((a) => (
            <div key={a.name} className="rounded-xl border border-white/10 p-3">
              <p className="font-semibold text-foreground">{a.name}</p>
              <p className="text-[14px]">{a.what}</p>
              <p className="text-[12px]">Por defecto: {a.def}</p>
            </div>
          ))}
        </div>
        <p>
          <strong>Antelación de los recordatorios:</strong> {REMINDER_LEADS.map(leadLabel).join(', ')}. Puedes marcar
          varias y recibirás un aviso en cada una. En tu privado se usa la antelación de tu cuenta; en un grupo, la del
          grupo.
        </p>
        <p>
          <strong>La 🔔 campanita</strong> de un launch llega siempre a tu privado (y a tu correo si está verificado),
          aunque tengas los demás avisos apagados o filtrados. Lo mismo con las <strong>respuestas</strong> a tus mensajes
          del chat en vivo.
        </p>
      </LegalSection>

      <LegalSection title="5. Filtros">
        <ul>
          <li>
            <strong>Solo ciertos tokens:</strong> con <code>/filter</code> o desde el perfil («Solo avisos de ciertos
            tokens»). Con la lista puesta, al chat solo le llegan calls, tesis, lanzamientos y recordatorios de esos
            tokens. El contrato es lo más fiable; un $TICKER puede coincidir con otros tokens. Máximo{' '}
            {MAX_TOKEN_FILTER}.
          </li>
          <li>
            <strong>Solo de gente que sigo:</strong> en <code>/settings</code> o el perfil. Solo llegan calls, tesis y
            lanzamientos publicados por cuentas que sigues en Cabal. En un grupo cuenta a quién sigue quien lo conectó.
          </li>
          <li>Los dos filtros se suman: con ambos activos llega solo lo que cumpla los dos.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Leaderboard de la comunidad">
        <p>
          Las calls que se dan desde un grupo o servidor cuentan para el ranking de esa comunidad (
          <code>/leaderboard</code>) y también para el ranking general de Cabal. El resultado de cada call se mide desde
          el precio del momento en que se dio y se va actualizando solo.
        </p>
      </LegalSection>

      <LegalSection title="7. Problemas frecuentes">
        <ul>
          <li>
            <strong>«Este chat no está conectado con Cabal»:</strong> genera un código en tu perfil y envíalo con{' '}
            <code>/link CÓDIGO</code>.
          </li>
          <li>
            <strong>«Ese código no vale o ya caducó»:</strong> cada código sirve una vez y caduca en poco tiempo; genera
            otro.
          </li>
          <li>
            <strong>«Solo un administrador puede cambiarlo»:</strong> en grupos y servidores, los ajustes los cambia
            quien conectó el chat o un administrador.
          </li>
          <li>
            <strong>Mi call no cuenta:</strong> conecta tu privado con el bot (sección 1). Sin él, el bot enseña la ficha
            del token pero no sabe quién eres.
          </li>
          <li>
            <strong>El bot dejó de avisar en el grupo:</strong> si lo expulsaron o perdió permisos, el chat queda
            desactivado. Vuelve a añadirlo y conéctalo con un código nuevo.
          </li>
        </ul>
      </LegalSection>
    </LegalPage>
  )
}
