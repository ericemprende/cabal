import { NextResponse } from 'next/server'

/**
 * Digital Asset Links: la prueba de que la app de Android (TWA, carpeta
 * android/) y la web son del mismo dueño. Con ella, Android abre Cabal a
 * pantalla completa sin barra del navegador; sin ella, se ve la barra con la URL.
 *
 * Tiene que responder igual en cabal.army y en beta.cabal.army (la app confía
 * en los dos) y sin redirecciones: el verificador de Google no las sigue. Por
 * eso src/proxy.ts deja fuera /.well-known.
 *
 * Env:
 *   ANDROID_PACKAGE             (por defecto army.cabal.app)
 *   ANDROID_SHA256_FINGERPRINTS huellas SHA-256 de los certificados, separadas
 *                               por comas: la de la clave de subida y la de
 *                               "App signing" de Play Console
 *                               (Configuración → Integridad de la app).
 */
export const dynamic = 'force-dynamic'

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f))

  const body = fingerprints.length
    ? [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: process.env.ANDROID_PACKAGE?.trim() || 'army.cabal.app',
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : []

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
