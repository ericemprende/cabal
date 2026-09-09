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
  async redirects() {
    return [
      { source: "/terms", destination: "/terminos", permanent: true },
      { source: "/privacy", destination: "/privacidad", permanent: true },
    ];
  },
};

export default nextConfig;
