import { NextResponse } from 'next/server'
import { SESSION_COOKIE, clearSessionCookieOptions } from '@/lib/auth'

// POST /api/auth/logout — cierra la sesión y vuelve al modo invitado
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', clearSessionCookieOptions())
  return res
}
