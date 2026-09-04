import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'

/** GET /api/admin/session — ¿hay sesión de admin válida? */
export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: isAdminRequest(req) })
}
