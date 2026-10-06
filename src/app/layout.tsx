import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { InstallApp } from "@/components/cabal/install-app";
import { ChapaDefs } from "@/components/cabal/chapa";
import { LangProvider } from "@/lib/i18n/provider";
import { resolveLang } from "@/lib/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // Sin esto, Next resuelve las imágenes relativas (/og-cabal.png) contra
  // localhost:3000, y cualquier página que herede estos metadatos le daba a X
  // una imagen imposible de descargar. Es la misma URL que siteUrl() de
  // lib/waitlist, repetida aquí para no cargar la base de datos en el layout.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://cabal.army"),
  title: "Cabal — Radar de Memecoins",
  description:
    "La plataforma social donde descubres los memecoins ANTES de que salgan. Lanzamientos posteados por la comunidad, tesis, historial de devs verificados y puntos canjeables por tokens.",
  keywords: ["Cabal", "memecoins", "lanzamientos", "radar", "crypto", "comunidad"],
  applicationName: "Cabal",
  // App instalable (PWA): el manifiesto lo genera src/app/manifest.ts y Next
  // enlaza solo. Esto es lo que iOS necesita para abrirla a pantalla completa.
  appleWebApp: { capable: true, title: "Cabal", statusBarStyle: "default" },
  openGraph: {
    title: "Cabal — Radar de Memecoins",
    description: "Descubre los memecoins ANTES de que salgan. Únete al Cabal.",
    siteName: "Cabal",
    type: "website",
    images: [{ url: "/og-cabal.png", width: 1200, height: 630, alt: "Cabal" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b08",
  width: "device-width",
  initialScale: 1,
  // App, no página: sin zoom con los dedos (en la app instalada se sentía como una pestaña)
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El idioma se resuelve aquí (cookie → navegador) para que el HTML salga ya
  // traducido: decidirlo en el navegador haría parpadear toda la página.
  const lang = await resolveLang();

  return (
    <html lang={lang} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        {/* Los degradados de las chapas, una sola vez para toda la página */}
        <ChapaDefs />
        <LangProvider initial={lang}>
          <Providers>{children}</Providers>
        </LangProvider>
        <InstallApp />
        {/* En móvil, por encima de la barra de navegación inferior */}
        <Toaster position="bottom-center" mobileOffset={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }} />
        {process.env.NODE_ENV === "production" && (
          <Script
            src="https://analytics.cabal.army/script.js"
            data-website-id="c5d0c8fd-3e10-4c95-bcee-406c27bb1e44"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
