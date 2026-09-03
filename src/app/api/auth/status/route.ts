import { NextRequest, NextResponse } from 'next/server'
import { appOrigin, getGoogleConfig, getXConfig } from '@/lib/oauth'

/**
 * GET /api/auth/status
 * Informa si las APIs reales de X / Google están configuradas y cuáles son las
 * redirect URIs exactas que deben registrarse en los portales de desarrolladores.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req)
  return NextResponse.json({
    x: {
      configured: !!getXConfig(),
      callbackUrl: `${origin}/api/auth/x/callback`,
    },
    google: {
      configured: !!getGoogleConfig(),
      callbackUrl: `${origin}/api/auth/google/callback`,
    },
  })
}
