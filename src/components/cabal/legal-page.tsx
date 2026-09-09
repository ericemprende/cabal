import Link from 'next/link'
import Image from 'next/image'

/**
 * Marco visual compartido por las páginas legales (/terminos y /privacidad).
 * Son documentos públicos y estáticos: los revisa X (Twitter) al verificar la
 * app, así que no dependen de sesión ni de datos de la base.
 */
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/cabal-logo.png" alt="Cabal" width={28} height={28} className="rounded" />
            <span className="font-semibold tracking-tight">Cabal</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/terminos" className="hover:text-foreground">Términos</Link>
            <Link href="/privacidad" className="hover:text-foreground">Privacidad</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: {updatedAt}</p>
        <div className="legal-body mt-10 space-y-8 text-[15px] leading-7 text-muted-foreground">
          {children}
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Cabal — cabal.army</span>
          <a href="mailto:legal@cabal.army" className="hover:text-foreground">legal@cabal.army</a>
        </div>
      </footer>
    </div>
  )
}

/** Sección con título; unifica el ritmo tipográfico de ambos documentos. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}
