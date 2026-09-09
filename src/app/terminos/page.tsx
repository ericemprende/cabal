import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/cabal/legal-page'
import { siteUrl } from '@/lib/waitlist'

const UPDATED_AT = '8 de septiembre de 2026'

export const metadata: Metadata = {
  title: 'Términos de Servicio — Cabal',
  description:
    'Condiciones de uso de Cabal (cabal.army): la plataforma social donde la comunidad descubre lanzamientos de memecoins.',
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: '/terminos' },
  robots: { index: true, follow: true },
}

export default function TerminosPage() {
  return (
    <LegalPage title="Términos de Servicio" updatedAt={UPDATED_AT}>
      <p>
        Estos Términos de Servicio (los «Términos») regulan el acceso y uso de{' '}
        <strong>Cabal</strong>, disponible en <a href="https://cabal.army">cabal.army</a> (el
        «Servicio»). Al crear una cuenta, entrar en la lista de espera o utilizar el Servicio de
        cualquier forma, aceptas estos Términos. Si no estás de acuerdo con ellos, no uses el
        Servicio.
      </p>

      <LegalSection title="1. Qué es Cabal">
        <p>
          Cabal es una plataforma social en la que la comunidad publica y comenta lanzamientos de
          criptomonedas y memecoins, comparte tesis de inversión, vota, acumula puntos y consulta el
          historial público de proyectos y creadores. Cabal es un espacio de{' '}
          <strong>información y conversación</strong>: no compra, vende, custodia ni gestiona
          activos digitales por ti.
        </p>
      </LegalSection>

      <LegalSection title="2. Nada de esto es asesoramiento financiero">
        <p>
          Todo el contenido del Servicio —publicaciones, lanzamientos, rankings, puntuaciones,
          comentarios y cualquier dato de mercado— tiene finalidad{' '}
          <strong>exclusivamente informativa y de entretenimiento</strong>. No constituye
          asesoramiento financiero, de inversión, legal ni fiscal, ni una recomendación de compra o
          venta de ningún activo.
        </p>
        <p>
          Los criptoactivos y, muy especialmente, los memecoins son extremadamente volátiles y de
          alto riesgo. Puedes perder la totalidad del dinero que destines a ellos. Las decisiones que
          tomes son tuyas y solo tuyas: investiga por tu cuenta antes de actuar.
        </p>
      </LegalSection>

      <LegalSection title="3. Requisitos de la cuenta">
        <ul>
          <li>Debes tener al menos 18 años y capacidad legal para aceptar estos Términos.</li>
          <li>
            Puedes registrarte con correo electrónico o mediante tu cuenta de X (Twitter) o Google.
            Si usas un proveedor externo, también te aplican las condiciones de ese proveedor.
          </li>
          <li>
            Eres responsable de la confidencialidad de tus credenciales y de toda la actividad
            realizada desde tu cuenta. Avísanos de inmediato si detectas un uso no autorizado.
          </li>
          <li>
            No puedes suplantar a otra persona o proyecto, ni crear cuentas múltiples para inflar
            votos, puntos o posiciones en los rankings.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Tu contenido">
        <p>
          Conservas la titularidad de todo lo que publiques en Cabal. Al publicarlo nos concedes una
          licencia mundial, no exclusiva, gratuita y transferible para alojar, almacenar, reproducir,
          adaptar el formato y mostrar ese contenido con el único fin de operar, promocionar y
          mejorar el Servicio. Esta licencia termina cuando eliminas el contenido, salvo por copias
          de seguridad y por el contenido que otras personas hayan compartido.
        </p>
        <p>
          Declaras que tienes los derechos necesarios sobre lo que publicas y que no infringe los
          derechos de terceros.
        </p>
      </LegalSection>

      <LegalSection title="5. Conducta prohibida">
        <p>No está permitido usar el Servicio para:</p>
        <ul>
          <li>
            Promocionar estafas, <em>rug pulls</em>, esquemas piramidales o de tipo{' '}
            <em>pump and dump</em>, ni manipular el precio de ningún activo.
          </li>
          <li>Publicar información falsa o engañosa sobre un proyecto, equipo o contrato.</li>
          <li>
            Publicar contenido ilegal, difamatorio, acosador, o que incite al odio o a la violencia.
          </li>
          <li>Difundir spam, publicidad no solicitada, malware o enlaces de phishing.</li>
          <li>
            Manipular el sistema de puntos, votos o referidos mediante bots, cuentas falsas o
            cualquier automatización no autorizada.
          </li>
          <li>
            Extraer datos de forma masiva (<em>scraping</em>), realizar ingeniería inversa, o
            interferir con la seguridad o la disponibilidad del Servicio.
          </li>
          <li>Vulnerar leyes o reglamentos aplicables, incluidas las sanciones internacionales.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Moderación">
        <p>
          Podemos revisar, ocultar o eliminar cualquier contenido y suspender o cancelar cuentas que
          incumplan estos Términos, con o sin aviso previo cuando el incumplimiento sea grave o
          suponga un riesgo para la comunidad. No estamos obligados a supervisar el contenido, pero
          nos reservamos el derecho a hacerlo.
        </p>
      </LegalSection>

      <LegalSection title="7. Puntos y recompensas">
        <p>
          Cabal puede otorgar puntos por participar, invitar a otras personas o compartir contenido.
          Los puntos son una función interna del Servicio: <strong>no son dinero</strong>, no tienen
          valor monetario garantizado, no son un instrumento financiero y no pueden transferirse ni
          canjearse fuera de los mecanismos que habilitemos. Podemos ajustar o retirar puntos
          obtenidos de forma fraudulenta, y cambiar las reglas del programa avisando por los canales
          del Servicio.
        </p>
      </LegalSection>

      <LegalSection title="8. Contenido y enlaces de terceros">
        <p>
          El Servicio muestra contenido publicado por otras personas y enlaces a sitios externos
          (exploradores de bloques, redes sociales, transmisiones en vivo, mercados). No controlamos
          ni respaldamos ese contenido ni esos sitios, y no respondemos de ellos. Verifica siempre
          los contratos y direcciones en fuentes oficiales antes de interactuar con ellos.
        </p>
      </LegalSection>

      <LegalSection title="9. Propiedad intelectual de Cabal">
        <p>
          El software, el diseño, la marca «Cabal», el logotipo y los demás elementos del Servicio
          nos pertenecen o los usamos bajo licencia. No puedes copiarlos, modificarlos ni usarlos
          comercialmente sin nuestro permiso escrito.
        </p>
      </LegalSection>

      <LegalSection title="10. Servicio «tal cual» y limitación de responsabilidad">
        <p>
          El Servicio se ofrece <strong>«tal cual» y «según disponibilidad»</strong>, sin garantías
          de ningún tipo, expresas o implícitas, incluidas las de comerciabilidad, idoneidad para un
          fin concreto, exactitud o funcionamiento ininterrumpido. Puede haber interrupciones,
          errores o pérdidas de datos.
        </p>
        <p>
          En la máxima medida permitida por la ley, no responderemos por daños indirectos,
          incidentales, especiales o consecuentes, ni por pérdida de beneficios, de oportunidades o
          de activos digitales derivada del uso del Servicio o de decisiones tomadas a partir de la
          información publicada en él.
        </p>
        <p>
          Nada en estos Términos excluye responsabilidades que no puedan limitarse legalmente, como
          las derivadas de dolo o de daños a las personas.
        </p>
      </LegalSection>

      <LegalSection title="11. Baja y terminación">
        <p>
          Puedes dejar de usar Cabal y solicitar la eliminación de tu cuenta en cualquier momento
          escribiendo a <a href="mailto:legal@cabal.army">legal@cabal.army</a>. Nosotros podemos
          suspender o cerrar el Servicio, total o parcialmente, avisando con antelación razonable
          salvo urgencia técnica o legal.
        </p>
      </LegalSection>

      <LegalSection title="12. Cambios en los Términos">
        <p>
          Podemos actualizar estos Términos. Publicaremos la nueva versión en esta página con su
          fecha de actualización y, si los cambios son sustanciales, lo anunciaremos en el Servicio.
          Seguir usando Cabal tras la entrada en vigor implica que los aceptas.
        </p>
      </LegalSection>

      <LegalSection title="13. Ley aplicable">
        <p>
          Estos Términos se rigen por la legislación española y cualquier controversia se someterá a
          los juzgados y tribunales competentes de España, sin perjuicio de los derechos que la
          normativa de consumo te reconozca en tu país de residencia.
        </p>
      </LegalSection>

      <LegalSection title="14. Contacto">
        <p>
          Para cualquier duda sobre estos Términos:{' '}
          <a href="mailto:legal@cabal.army">legal@cabal.army</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
