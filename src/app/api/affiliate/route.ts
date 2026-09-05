import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureAffiliatePresets, parseAffiliateLinks } from '@/lib/affiliate'
import type { AffiliatePlatformDTO } from '@/lib/types'

// GET público: plataformas activas con enlace configurado (para los botones "Comprar")
export async function GET() {
  try {
    await ensureAffiliatePresets()
    const rows = await db.affiliatePlatform.findMany({
      where: { active: true, OR: [{ url: { not: '' } }, { links: { not: '{}' } }] },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    const dto: AffiliatePlatformDTO[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      url: r.url,
      links: parseAffiliateLinks(r.links),
      active: r.active,
      order: r.order,
    }))
    return NextResponse.json(dto)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
