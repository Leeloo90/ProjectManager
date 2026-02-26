import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { db } from '@/lib/db'
import { businessSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?gmail=error&reason=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?gmail=error&reason=no_code', request.url))
  }

  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?gmail=error&reason=missing_credentials', request.url))
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3000/api/gmail/callback'
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      // This can happen if the user already authorized and Google didn't return a new refresh token.
      // The /api/gmail/auth route uses prompt: 'consent' to prevent this, but handle it just in case.
      return NextResponse.redirect(
        new URL('/settings?gmail=error&reason=no_refresh_token', request.url)
      )
    }

    await db
      .update(businessSettings)
      .set({ gmailRefreshToken: tokens.refresh_token })
      .where(eq(businessSettings.id, 'singleton'))

    return NextResponse.redirect(new URL('/settings?gmail=connected', request.url))
  } catch (err) {
    console.error('[gmail/callback] Error exchanging code:', err)
    return NextResponse.redirect(new URL('/settings?gmail=error&reason=token_exchange_failed', request.url))
  }
}
