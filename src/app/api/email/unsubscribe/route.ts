import { NextResponse } from 'next/server'
import { optOut, readUnsubscribe } from '@/lib/email-broadcast'

/**
 * Baja de las novedades por correo, con el enlace firmado que va en cada anuncio.
 *  - GET  enseña una página con el botón de confirmar. No da de baja por sí
 *         sola: los antivirus del correo abren los enlaces y darían de baja a
 *         gente que no lo pidió.
 *  - POST da de baja. Es también la "baja en un clic" (List-Unsubscribe-Post)
 *         que usan Gmail y Yahoo.
 */

function page(title: string, body: string): NextResponse {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Cabal</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0b08;font-family:Arial,Helvetica,sans-serif;color:#e8ebe2;padding:16px">
<div style="max-width:420px;background:#121410;border:1px solid #2a2e24;border-radius:16px;padding:28px;text-align:center">
<p style="margin:0 0 14px;font-size:13px;font-weight:bold;letter-spacing:2px;color:#8FA83F">CABAL</p>
<h1 style="margin:0 0 12px;font-size:20px">${title}</h1>${body}</div></body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

const INVALID = () =>
  page('Enlace no válido', '<p style="color:#9aa08e;font-size:14px">El enlace está incompleto o caducó. Usa el del último correo que te llegó.</p>')

export async function GET(req: Request) {
  const url = new URL(req.url)
  const e = url.searchParams.get('e')
  const s = url.searchParams.get('s')
  const email = readUnsubscribe(e, s)
  if (!email) return INVALID()
  return page(
    '¿Dejar de recibir novedades?',
    `<p style="color:#9aa08e;font-size:14px;line-height:1.5">No mandaremos más anuncios a <b>${email.replace(/</g, '&lt;')}</b>. Los avisos de seguridad de tu cuenta seguirán llegando.</p>
<form method="post" action="/api/email/unsubscribe?e=${e}&s=${s}"><button style="margin-top:8px;background:#8FA83F;color:#0a0b08;font-weight:bold;border:0;padding:10px 18px;border-radius:10px;font-size:14px;cursor:pointer">Darme de baja</button></form>`
  )
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const email = readUnsubscribe(url.searchParams.get('e'), url.searchParams.get('s'))
  if (!email) return INVALID()
  await optOut(email)
  return page('Listo, te diste de baja', '<p style="color:#9aa08e;font-size:14px">No volverás a recibir novedades de Cabal por correo.</p>')
}
