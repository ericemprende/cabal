import { NextResponse } from 'next/server'
import { getPointRules } from '@/lib/api-helpers'

// GET /api/points/rules — reglas de puntos vigentes (las que se editan en el
// panel admin), para que los "+25", "+40"… de la interfaz salgan de aquí.
export async function GET() {
  try {
    return NextResponse.json(await getPointRules())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
