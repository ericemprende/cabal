import { NextResponse } from 'next/server'
import { launchFeeSettings } from '@/lib/pump-launch'
import { cabalConfigId } from '@/lib/cabal-launch'

/**
 * GET /api/pump/fee — lo que cobra Cabal por lanzar en cada launchpad
 * ({ fees: { pump, bonk, cabal } }), para enseñarlo antes de firmar.
 */
export async function GET() {
  const [{ fees }, config] = await Promise.all([launchFeeSettings(), cabalConfigId()])
  // cabalReady: Cabal Launch solo lanza cuando su configuración existe
  return NextResponse.json({ fees, cabalReady: Boolean(config) })
}
