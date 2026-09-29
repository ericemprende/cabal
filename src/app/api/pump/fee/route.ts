import { NextResponse } from 'next/server'
import { pumpLaunchFee } from '@/lib/pump-launch'

/** GET /api/pump/fee — lo que cobra Cabal por lanzar, para enseñarlo antes de firmar. */
export async function GET() {
  const { sol } = await pumpLaunchFee()
  return NextResponse.json({ sol })
}
