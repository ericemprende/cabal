import { NextRequest, NextResponse } from 'next/server'
import { appOrigin, getGoogleConfig, getXConfig, socialDemoAllowed } from '@/lib/oauth'

/**
 * GET /api/auth/status
 * Informa si las APIs reales de X / Google están configuradas y cuáles son las
 * redirect URIs exactas que deben registrarse en los portales de desarrolladores.
 * `demo` dice si, a falta de credenciales, se puede usar el flujo simulado.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req)
  return NextResponse.json({
    x: {
      configured: !!getXConfig(),
      demo: socialDemoAllowed('x'),
      callbackUrl: `${origin}/api/auth/x/callback`,
    },
    google: {
      configured: !!getGoogleConfig(),
      demo: socialDemoAllowed('google'),
      callbackUrl: `${origin}/api/auth/google/callback`,
    },
  })
}
