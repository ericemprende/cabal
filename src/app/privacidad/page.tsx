import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/cabal/legal-page'
import { siteUrl } from '@/lib/waitlist'

const UPDATED_AT = '8 de septiembre de 2026'

export const metadata: Metadata = {
  title: 'Política de Privacidad — Cabal',
  description:
    'Qué datos recoge Cabal (cabal.army), para qué los usa, con quién los comparte y cómo ejercer tus derechos.',
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: '/privacidad' },
  robots: { index: true, follow: true },
}

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad" updatedAt={UPDATED_AT}>
      <p>
        Esta política explica qué datos personales tratamos cuando usas{' '}
        <strong>Cabal</strong> (<a href="https://cabal.army">cabal.army</a>), con qué finalidad, con
        quién los compartimos y qué derechos tienes sobre ellos. Está redactada conforme al
        Reglamento General de Protección de Datos (RGPD).
      </p>

      <LegalSection title="1. Responsable del tratamiento">
        <p>
          El responsable del tratamiento es el equipo de Cabal. Puedes contactarnos para cualquier
          asunto de privacidad en <a href="mailto:privacidad@cabal.army">privacidad@cabal.army</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Datos que recogemos">
        <ul>
          <li>
            <strong>Datos de cuenta.</strong> Tu nombre de usuario (handle), nombre público, avatar,
            biografía y, si te registras con correo, tu dirección de email y una contraseña que
            guardamos siempre <strong>cifrada mediante hash</strong> (nunca en texto claro).
          </li>
          <li>
            <strong>Inicio de sesión con X (Twitter).</strong> Si conectas tu cuenta de X, recibimos
            de su API tu identificador, tu nombre de usuario y tu foto de perfil públicos (permisos{' '}
            <code>users.read</code> y <code>tweet.read</code>). No leemos tus mensajes directos, no
            publicamos en tu nombre sin que lo pidas expresamente desde la app, y no accedemos a tu
            contraseña de X.
          </li>
          <li>
            <strong>Inicio de sesión con Google.</strong> Si usas Google, recibimos tu dirección de
            correo, tu nombre y tu foto de perfil (permisos <code>openid</code>, <code>email</code> y{' '}
            <code>profile</code>).
          </li>
          <li>
            <strong>Contenido que publicas.</strong> Lanzamientos, publicaciones, tesis, comentarios,
            votos, enlaces e imágenes que subas. Este contenido es público dentro del Servicio.
          </li>
          <li>
            <strong>Direcciones de wallet.</strong> Si vinculas una wallet de forma voluntaria,
            guardamos su dirección pública y el estado de verificación. Nunca te pedimos ni
            almacenamos claves privadas ni frases semilla; nadie de Cabal te las pedirá jamás.
          </li>
          <li>
            <strong>Actividad y reputación.</strong> Puntos, historial de puntos, referidos,
            seguidores y estadísticas de aciertos que se derivan de tu uso del Servicio.
          </li>
          <li>
            <strong>Datos técnicos.</strong> Dirección IP, tipo de navegador y registros de acceso,
            que usamos de forma temporal para seguridad y para limitar el número de peticiones
            (<em>rate limiting</em>).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Para qué usamos los datos y con qué base legal">
        <ul>
          <li>
            <strong>Prestar el Servicio</strong> —crear tu cuenta, autenticarte, mostrar tu perfil y
            tu contenido, calcular puntos y rankings—. Base legal: ejecución del contrato entre tú y
            nosotros (estos son nuestros Términos de Servicio).
          </li>
          <li>
            <strong>Seguridad y prevención del abuso</strong> —detectar bots, cuentas múltiples,
            spam y manipulación de puntos—. Base legal: interés legítimo.
          </li>
          <li>
            <strong>Comunicaciones operativas</strong> sobre tu cuenta, cambios del Servicio o
            incidencias de seguridad. Base legal: ejecución del contrato e interés legítimo.
          </li>
          <li>
            <strong>Mejorar el producto</strong> a partir de métricas agregadas de uso. Base legal:
            interés legítimo.
          </li>
          <li>
            <strong>Cumplir obligaciones legales</strong> cuando la ley nos lo exija. Base legal:
            obligación legal.
          </li>
        </ul>
        <p>
          <strong>No vendemos tus datos personales</strong> ni los cedemos a terceros con fines
          publicitarios.
        </p>
      </LegalSection>

      <LegalSection title="4. Cookies">
        <p>
          Usamos una cookie de sesión, técnicamente necesaria, para mantenerte identificado tras
          iniciar sesión, y cookies temporales durante el proceso de autenticación con X o Google
          para prevenir ataques CSRF. No usamos cookies publicitarias ni de seguimiento entre sitios.
          Si bloqueas las cookies necesarias, no podrás iniciar sesión.
        </p>
      </LegalSection>

      <LegalSection title="5. Con quién compartimos los datos">
        <p>
          Solo con los proveedores que necesitamos para operar, y únicamente con esa finalidad:
        </p>
        <ul>
          <li>Nuestro proveedor de alojamiento e infraestructura, donde se ejecuta el Servicio.</li>
          <li>La base de datos y la caché donde se almacena tu información.</li>
          <li>
            X (Twitter) y Google, exclusivamente cuando tú decides iniciar sesión con ellos. El
            tratamiento que ellos hacen se rige por sus propias políticas de privacidad.
          </li>
          <li>
            Autoridades públicas, si existe un requerimiento legal válido que nos obligue a ello.
          </li>
        </ul>
        <p>
          Si alguno de estos proveedores trata datos fuera del Espacio Económico Europeo, la
          transferencia se ampara en las Cláusulas Contractuales Tipo aprobadas por la Comisión
          Europea o en una decisión de adecuación.
        </p>
      </LegalSection>

      <LegalSection title="6. Cuánto tiempo conservamos los datos">
        <p>
          Conservamos los datos de tu cuenta mientras esta siga activa. Si solicitas la eliminación,
          borramos tus datos personales en un plazo máximo de 30 días, salvo lo que debamos conservar
          por obligación legal o para resolver disputas y prevenir fraude. Los registros técnicos
          (IP, logs de acceso) se conservan un máximo de 90 días. El contenido que hayas publicado en
          público puede permanecer visible de forma anonimizada.
        </p>
      </LegalSection>

      <LegalSection title="7. Seguridad">
        <p>
          Ciframos el tráfico con HTTPS, guardamos las contraseñas con un algoritmo de hash con sal,
          restringimos el acceso interno a los datos y aplicamos límites de peticiones contra abusos.
          Ningún sistema es infalible: si se produjera una brecha que afecte a tus datos, te lo
          notificaremos y lo comunicaremos a la autoridad de control cuando proceda.
        </p>
      </LegalSection>

      <LegalSection title="8. Tus derechos">
        <p>Puedes ejercer en cualquier momento tus derechos de:</p>
        <ul>
          <li>
            <strong>Acceso</strong> a los datos que tenemos sobre ti.
          </li>
          <li>
            <strong>Rectificación</strong> de los datos inexactos.
          </li>
          <li>
            <strong>Supresión</strong> («derecho al olvido»), incluida la eliminación de tu cuenta.
          </li>
          <li>
            <strong>Limitación</strong> y <strong>oposición</strong> al tratamiento.
          </li>
          <li>
            <strong>Portabilidad</strong>, para recibir tus datos en un formato estructurado.
          </li>
          <li>
            <strong>Retirar tu consentimiento</strong> cuando el tratamiento se base en él, sin que
            ello afecte a la licitud del tratamiento previo.
          </li>
        </ul>
        <p>
          Escríbenos a <a href="mailto:privacidad@cabal.army">privacidad@cabal.army</a> y
          responderemos en el plazo de un mes. También puedes revocar el acceso de Cabal desde los
          ajustes de aplicaciones conectadas de tu cuenta de X o de Google. Si crees que no hemos
          atendido correctamente tu solicitud, tienes derecho a reclamar ante la Agencia Española de
          Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>) o ante la autoridad de tu
          país.
        </p>
      </LegalSection>

      <LegalSection title="9. Menores de edad">
        <p>
          Cabal no está dirigido a menores de 18 años y no recogemos datos de forma consciente sobre
          ellos. Si detectamos una cuenta de una persona menor de edad, la eliminaremos.
        </p>
      </LegalSection>

      <LegalSection title="10. Cambios en esta política">
        <p>
          Si modificamos esta política publicaremos la nueva versión en esta misma página, con su
          fecha de actualización. Si los cambios son sustanciales, te lo avisaremos dentro del
          Servicio antes de que entren en vigor.
        </p>
      </LegalSection>

      <LegalSection title="11. Contacto">
        <p>
          Dudas sobre privacidad: <a href="mailto:privacidad@cabal.army">privacidad@cabal.army</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
