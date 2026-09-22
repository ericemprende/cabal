import { NextResponse } from 'next/server'
import { guideConfig } from '@/lib/guide-settings'

/**
 * GET /api/guide — el escuadrón de Radio Cabal tal y como lo ve la app:
 * quién está en servicio, con qué foto y quién atiende por defecto.
 * Público: el asistente también saluda a quien todavía no tiene cuenta.
 */
export async function GET() {
  try {
    const cfg = await guideConfig()
    return NextResponse.json({
      ...cfg,
      characters: cfg.characters.filter((c) => c.enabled),
    })
  } catch {
    // Sin base de datos el asistente no debe tumbar la app: se queda callado.
    return NextResponse.json({ enabled: false, welcome: false, defaultCharacterId: '', characters: [] })
  }
}
