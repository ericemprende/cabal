import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

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
  title: "Cabal — Radar de Memecoins",
  description:
    "La plataforma social donde descubres los memecoins ANTES de que salgan. Lanzamientos posteados por la comunidad, tesis, historial de devs verificados y puntos canjeables por tokens.",
  keywords: ["Cabal", "memecoins", "lanzamientos", "radar", "crypto", "comunidad"],
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
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
