import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { toUserDTO } from '@/lib/serializers'

// GET /api/admin/posts — tesis y comentarios del feed, para moderar (borrar contenido inadecuado)
// Query opcional: ?kind=thesis|comment para filtrar
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const kind = new URL(req.url).searchParams.get('kind')
    const posts = await db.post.findMany({
      where: kind === 'thesis' || kind === 'comment' ? { kind } : { kind: { in: ['thesis', 'comment'] } },
      include: { user: true, launch: true, token: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
    const dto = posts.map((p) => ({
      id: p.id,
      kind: p.kind,
      content: p.content,
      likes: p.likes,
      createdAt: p.createdAt.toISOString(),
      user: toUserDTO(p.user),
      launchName: p.launch?.name ?? null,
      tokenName: p.token?.name ?? null,
    }))
    return NextResponse.json({ posts: dto })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// DELETE /api/admin/posts?id=… — elimina una tesis o comentario inadecuado del feed
export async function DELETE(req: Request) {
  try {
    await requireAdmin(req)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const target = await db.post.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 })
    await db.$transaction([
      db.vote.deleteMany({ where: { target: 'post', targetId: id } }),
      db.post.delete({ where: { id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
