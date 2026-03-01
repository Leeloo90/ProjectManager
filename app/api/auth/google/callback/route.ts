import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { db } from '@/lib/db'
import { googleAuth } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  console.log('[google/callback] ─── Callback received ───────────────────────')
  console.log('[google/callback] URL:', request.url)

  let state = 'settings'
  let redirectBase = '/settings'

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    state = searchParams.get('state') ?? 'settings'
    const error = searchParams.get('error')

    console.log('[google/callback] state:', state)
    console.log('[google/callback] code present:', !!code)
    console.log('[google/callback] error param:', error ?? 'none')

    redirectBase = state === 'settings'
      ? '/settings'
      : `/projects/${state}/footage`

    if (error) {
      console.error('[google/callback] Google returned error:', error)
      return NextResponse.redirect(
        new URL(`${redirectBase}?google=error&reason=${encodeURIComponent(error)}`, request.url),
      )
    }

    if (!code) {
      console.error('[google/callback] No code param in callback URL')
      return NextResponse.redirect(
        new URL(`${redirectBase}?google=error&reason=no_code`, request.url),
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

    console.log('[google/callback] GOOGLE_CLIENT_ID present:', !!clientId)
    console.log('[google/callback] GOOGLE_CLIENT_SECRET present:', !!clientSecret)
    console.log('[google/callback] GOOGLE_REDIRECT_URI:', redirectUri ?? 'MISSING')

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[google/callback] Missing env vars — cannot proceed')
      return NextResponse.redirect(
        new URL(`${redirectBase}?google=error&reason=missing_credentials`, request.url),
      )
    }

    console.log('[google/callback] Exchanging code for tokens...')
    let tokens: Awaited<ReturnType<InstanceType<typeof google.auth.OAuth2>['getToken']>>['tokens']
    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      const result = await oauth2Client.getToken(code)
      tokens = result.tokens
      console.log('[google/callback] Token exchange succeeded')
      console.log('[google/callback] access_token present:', !!tokens.access_token)
      console.log('[google/callback] refresh_token present:', !!tokens.refresh_token)
      console.log('[google/callback] expiry_date:', tokens.expiry_date ?? 'none')
    } catch (tokenErr: any) {
      console.error('[google/callback] Token exchange failed:', tokenErr?.message ?? tokenErr)
      console.error('[google/callback] Token error details:', JSON.stringify(tokenErr?.response?.data ?? {}, null, 2))
      return NextResponse.redirect(
        new URL(`${redirectBase}?google=error&reason=token_exchange_failed`, request.url),
      )
    }

    if (!tokens.refresh_token) {
      console.error('[google/callback] No refresh_token in response — revoke app access at myaccount.google.com/permissions and reconnect')
      return NextResponse.redirect(
        new URL(`${redirectBase}?google=error&reason=no_refresh_token`, request.url),
      )
    }

    console.log('[google/callback] Saving tokens to google_auth table...')
    try {
      await db
        .insert(googleAuth)
        .values({
          id: 'singleton',
          accessToken: tokens.access_token ?? null,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expiry_date ?? null,
        })
        .onConflictDoUpdate({
          target: googleAuth.id,
          set: {
            accessToken: tokens.access_token ?? null,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expiry_date ?? null,
            updatedAt: new Date().toISOString(),
          },
        })
      console.log('[google/callback] ✓ Tokens saved successfully')
    } catch (dbErr: any) {
      console.error('[google/callback] DB write failed:', dbErr?.message ?? dbErr)
      return NextResponse.redirect(
        new URL(`${redirectBase}?google=error&reason=db_write_failed`, request.url),
      )
    }

    console.log('[google/callback] ✓ Redirecting to', `${redirectBase}?google=connected`)
    return NextResponse.redirect(
      new URL(`${redirectBase}?google=connected`, request.url),
    )

  } catch (err: any) {
    console.error('[google/callback] Unexpected error:', err?.message ?? err)
    try {
      return NextResponse.redirect(
        new URL(`${redirectBase}?google=error&reason=unexpected_error`, request.url),
      )
    } catch {
      return NextResponse.json(
        { error: 'OAuth callback failed', details: err?.message ?? String(err) },
        { status: 500 },
      )
    }
  }
}
