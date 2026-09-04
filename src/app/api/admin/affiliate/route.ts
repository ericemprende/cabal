import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ForbiddenError, requireAdmin } from '@/lib/api-helpers'
import { ensureAffiliatePresets, isValidAffiliateUrl, parseAffiliateLinks, sanitizeAffiliateLinks } from '@/lib/affiliate'
import type { AffiliatePlatformDTO } from '@/lib/types'

const toDTO = (r: {
  id: string
  name: string
  slug: string
  url: string
  links: string
  active: boolean
  order: number
}): AffiliatePlatformDTO => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  url: r.url,
  links: parseAffiliateLinks(r.links),
  active: r.active,
  order: r.order,
})

// GET admin: lista completa (incluye inactivas y sin url)
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    await ensureAffiliatePresets()
    const rows = await db.affiliatePlatform.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(rows.map(toDTO))
  } catch (e) {
    return handle(e)
  }
}

const cleanSlug = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24)

// POST admin: crea una plataforma afiliada { name, url?, links? }
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
    if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    const url = typeof body.url === 'string' ? body.url.trim().slice(0, 500) : ''
    if (url && !isValidAffiliateUrl(url)) {
      return NextResponse.json({ error: 'La URL debe empezar por https://' }, { status: 400 })
    }
    const links = sanitizeAffiliateLinks(body.links)
    const base = cleanSlug(name) || 'plataforma'
    let slug = base
    for (let i = 2; ; i++) {
      const exists = await db.affiliatePlatform.findUnique({ where: { slug } })
      if (!exists) break
      slug = `${base}-${i}`
    }
    const last = await db.affiliatePlatform.findFirst({ orderBy: { order: 'desc' } })
    const created = await db.affiliatePlatform.create({
      data: {
        name,
        slug,
        url,
        links: JSON.stringify(links),
        active: Boolean(body.active) && (!!url || Object.keys(links).length > 0),
        order: (last?.order ?? 0) + 1,
      },
    })
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 })
  } catch (e) {
    return handle(e)
  }
}

// PATCH admin: actualiza { id, name?, url?, links?, active? }
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json()
    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }
    const target = await db.affiliatePlatform.findUnique({ where: { id: body.id } })
    if (!target) return NextResponse.json({ error: 'Plataforma no encontrada' }, { status: 404 })

    const data: Record<string, string | boolean> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 40)
    let nextLinks = parseAffiliateLinks(target.links)
    if ('links' in body) {
      nextLinks = sanitizeAffiliateLinks(body.links)
      data.links = JSON.stringify(nextLinks)
    }
    if ('url' in body) {
      const url = typeof body.url === 'string' ? body.url.trim().slice(0, 500) : ''
      if (url && !isValidAffiliateUrl(url)) {
        return NextResponse.json({ error: 'La URL debe empezar por https://' }, { status: 400 })
      }
      data.url = url
    }
    // Si se queda sin ningún enlace (madre ni por red), deja de mostrarse aunque siga activa
    if (typeof body.active === 'boolean') {
      const nextUrl = typeof data.url === 'string' ? data.url : target.url
      if (body.active && !nextUrl && Object.keys(nextLinks).length === 0) {
        return NextResponse.json(
          { error: 'Pega al menos un enlace de referido (general o DE LA RED …) antes de activar' },
          { status: 400 }
        )
      }
      data.active = body.active
    }
    const finalUrl = typeof data.url === 'string' ? data.url : target.url
    const finalLinks = 'links' in data ? nextLinks : parseAffiliateLinks(target.links)
    if (!finalUrl && Object.keys(finalLinks).length === 0) data.active = false

    await db.affiliatePlatform.update({ where: { id: body.id }, data })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handle(e)
  }
}

// DELETE admin: elimina la plataforma ?id=
export async function DELETE(req: Request) {
  try {
    await requireAdmin(req)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await db.affiliatePlatform.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handle(e)
  }
}

function handle(e: unknown) {
  const err = e as Error
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 })
  return NextResponse.json({ error: err.message }, { status: 500 })
}
