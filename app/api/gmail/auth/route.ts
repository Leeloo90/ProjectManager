import { NextResponse } from 'next/server'

// Legacy route — redirects to the unified Google OAuth flow
export function GET() {
  return NextResponse.redirect(new URL('/api/auth/google?origin=settings', 'http://localhost:3000'))
}
