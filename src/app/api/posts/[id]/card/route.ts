import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchCallResult } from '@/lib/chain-stats'
import { renderCallResultCard } from '@/lib/call-result-card'
import { cached } from '@/lib/cache'

// GET /api/posts/[id]/card — imagen JPEG con el resultado de una call, para
// que el autor la descargue/comparta a mano. Pública: las calls son
// públicas por diseño.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const post = await db.post.findUnique({ where: { id }, include: { user: true } })
    if (!post || post.kind !== 'call' || !post.contract || !post.network) {
      return NextResponse.json({ error: 'Esta call no tiene contrato/red' }, { status: 404 })
    }

    const result = await cached(`call-result:${id}`, 20, () =>
      fetchCallResult(post.network!, post.contract!, post.createdAt)
    )

    const avatarUrl = /^https?:\/\/|^\/uploads\//.test(post.user.avatar) ? post.user.avatar : null
    const jpeg = await renderCallResultCard({
      handle: post.user.handle,
      avatarUrl,
      symbol: result.symbol,
      contract: post.contract,
      pctChange: result.pctChange,
      entryMc: result.entryMc,
      currentMc: result.currentMc,
      peakMc: result.peakMc,
      multiple: result.multiple,
      peakMultiple: result.peakMultiple,
      calledAt: post.createdAt,
    })

    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'private, max-age=20',
        'content-disposition': `inline; filename="call-${id}.jpg"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
