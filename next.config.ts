import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /**
   * Alias en inglés de las páginas legales: los formularios de verificación
   * (X, Google) y los enlaces de terceros suelen apuntar a /terms y /privacy.
   */
  /**
   * Cabeceras de seguridad básicas. La CSP solo cierra el enmarcado, <base> y
   * plugins: una lista de scripts permitidos rompería Stripe, NOWPayments,
   * Umami y los gráficos incrustados. /embed queda fuera del bloqueo de
   * enmarcado porque existe para meterse en webs ajenas.
   */
  async headers() {
    const common = [
      { key: "Strict-Transport-Security", value: "max-age=63072000" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [
      {
        source: "/((?!embed).*)",
        headers: [
          ...common,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          ...common,
          { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/terms", destination: "/terminos", permanent: true },
      { source: "/privacy", destination: "/privacidad", permanent: true },
    ];
  },
};

export default nextConfig;
