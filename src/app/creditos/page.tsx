import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/cabal/legal-page'
import { siteUrl } from '@/lib/waitlist'

const UPDATED_AT = '22 de septiembre de 2026'

export const metadata: Metadata = {
  title: 'Créditos — Cabal',
  description:
    'Autores y licencias del material de terceros que usa Cabal: las siluetas de las insignias, los iconos de la interfaz y las tipografías.',
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: '/creditos' },
  robots: { index: true, follow: true },
}

/**
 * Atribución del material de terceros. No es una página de cortesía: las
 * siluetas de las chapas son CC BY 3.0 y esa licencia exige nombrar a sus
 * autores. Este es el sitio donde se hace.
 */
export default function CreditosPage() {
  return (
    <LegalPage title="Créditos" updatedAt={UPDATED_AT}>
      <p>
        Cabal está construido sobre trabajo de otra gente. Aquí está quién lo hizo y bajo qué
        licencia lo usamos.
      </p>

      <LegalSection title="Las insignias y los iconos de la interfaz">
        <p>
          Las siluetas de las chapas —la llama del hype, el radar, las balas, los galones, los
          pergaminos, los emblemas— vienen de{' '}
          <a href="https://game-icons.net" target="_blank" rel="noopener noreferrer">
            game-icons.net
          </a>
          , una colección de más de cuatro mil iconos hechos por y para gente de videojuegos.
        </p>
        <p>
          Son obra de <strong>Lorc</strong>, <strong>Delapouite</strong>, <strong>Skoll</strong> y{' '}
          <strong>Carl Olsen</strong>, y se usan bajo licencia{' '}
          <a
            href="https://creativecommons.org/licenses/by/3.0/deed.es"
            target="_blank"
            rel="noopener noreferrer"
          >
            Creative Commons Attribution 3.0
          </a>
          . Cabal las modifica: las monta sobre una placa con bisel y les aplica sus propios
          colores, que es algo que la licencia permite expresamente.
        </p>
        <p>
          El resto de iconos de la interfaz son de{' '}
          <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
            Lucide
          </a>{' '}
          (licencia ISC).
        </p>
      </LegalSection>

      <LegalSection title="Los logotipos de otras marcas">
        <p>
          Los logotipos de Telegram, Discord, X y de las cadenas de bloques —Solana, Base, Ethereum,
          BNB Chain, Tron, Robinhood— pertenecen a sus respectivos dueños. Cabal los usa únicamente
          para identificar el servicio o la red a la que enlaza, que es lo que la ley llama uso
          nominativo. Ni son marcas nuestras ni implican que esas empresas respalden Cabal.
        </p>
        <p>
          Los trazados proceden de{' '}
          <a href="https://simpleicons.org" target="_blank" rel="noopener noreferrer">
            Simple Icons
          </a>
          , que los publica en dominio público (CC0).
        </p>
      </LegalSection>

      <LegalSection title="Las tipografías">
        <p>
          Space Grotesk, Geist y Geist Mono, todas bajo{' '}
          <a
            href="https://openfontlicense.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            SIL Open Font License
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Dónde no usamos nada de esto">
        <p>
          Las siluetas de game-icons.net solo aparecen dentro de la aplicación, donde este crédito
          las acompaña. No se usan en las tarjetas que se comparten en redes ni en publicidad: en
          una imagen que viaja sola, la atribución no viaja con ella. Ahí va el logotipo de Cabal,
          que es nuestro.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
