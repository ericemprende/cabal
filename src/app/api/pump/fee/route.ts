import { NextResponse } from 'next/server'
import { launchFeeSettings } from '@/lib/pump-launch'

/**
 * GET /api/pump/fee — lo que cobra Cabal por lanzar en cada launchpad
 * ({ fees: { pump, bonk, cabal } }), para enseñarlo antes de firmar.
 */
export async function GET() {
  const { fees } = await launchFeeSettings()
  return NextResponse.json({ fees })
}
